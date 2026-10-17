'use strict';

// Bot de Telegram para administracao remota das SUAS sessoes ja autenticadas.
//
// Principios de seguranca desta ferramenta:
//  - NAO guarda senhas. Voce loga uma vez; os cookies ficam salvos no perfil
//    persistente ./browser-profile. Quando um login novo e necessario, voce
//    digita usuario e senha no Telegram (/login): o bot preenche direto no
//    navegador, apaga a sua mensagem e esquece o valor. A IA nunca ve a senha.
//  - So responde ao SEU usuario (TELEGRAM_ALLOWED_USER_ID). Qualquer outra
//    pessoa e ignorada.
//  - So abre URLs que estao na whitelist sistemas.json. Sites novos nao sao
//    abertos automaticamente, e credenciais so sao digitadas em hosts dela.
//  - O token e lido do .env (nunca fica escrito no codigo).
//  - A porta de controle local (pedido de login) e a porta do navegador (CDP)
//    so escutam em 127.0.0.1: nada fica exposto na rede.

const path = require('path');
const fs = require('fs');
const http = require('http');
const TelegramBot = require('node-telegram-bot-api');
const { chromium } = require('playwright');

const PROFILE_DIR = path.join(__dirname, 'browser-profile');
const SISTEMAS_PATH = path.join(__dirname, 'sistemas.json');

// --- Configuracao obrigatoria, vinda do .env ---
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER_ID = Number(process.env.TELEGRAM_ALLOWED_USER_ID);
const HEADLESS = process.env.HEADLESS === 'true';
// Porta local onde a IA pede um login novo (0 desliga).
const CONTROLE_PORTA = Number(process.env.CONTROLE_PORTA ?? 8765);
// Porta local do navegador (Chrome DevTools Protocol) para a IA controlar a
// pagina (0 desliga).
const CDP_PORTA = Number(process.env.CDP_PORTA ?? 9222);
const LOGIN_EXPIRA_MS = 5 * 60 * 1000;

if (!TOKEN || !Number.isFinite(ALLOWED_USER_ID) || ALLOWED_USER_ID <= 0) {
  console.error(
    'Faltam variaveis no .env. Preencha TELEGRAM_BOT_TOKEN e ' +
      'TELEGRAM_ALLOWED_USER_ID (veja .env.example).'
  );
  process.exit(1);
}

// --- Whitelist de sistemas conhecidos ---
function carregarSistemas() {
  try {
    return JSON.parse(fs.readFileSync(SISTEMAS_PATH, 'utf8'));
  } catch (err) {
    console.error('Nao consegui ler sistemas.json:', err.message);
    return {};
  }
}

function hostDe(url) {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

function hostPermitido(url, sistemas) {
  const hosts = new Set(Object.values(sistemas).map((s) => hostDe(s.url)).filter(Boolean));
  return hosts.has(hostDe(url));
}

// --- Navegador (perfil persistente, carregado so quando precisa) ---
let contexto = null;
let pagina = null;
let abrindo = null; // evita abrir dois navegadores no mesmo perfil ao mesmo tempo

async function garantirNavegador() {
  if (contexto) return;
  if (!abrindo) abrindo = abrirNavegador().finally(() => (abrindo = null));
  await abrindo;
}

async function abrirNavegador() {
  const args =
    CDP_PORTA > 0
      ? [`--remote-debugging-port=${CDP_PORTA}`, '--remote-debugging-address=127.0.0.1']
      : [];
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: HEADLESS,
    args,
  });
  ctx.on('close', () => {
    contexto = null;
    pagina = null;
  });
  pagina = ctx.pages()[0] || (await ctx.newPage());
  contexto = ctx;
}

async function tirarPrint() {
  await garantirNavegador();
  return pagina.screenshot({ fullPage: false });
}

// Abre um sistema da whitelist. Devolve null se o nome nao existe.
async function abrirSistema(nome) {
  const sistemas = carregarSistemas();
  const alvo = sistemas[nome];
  if (!alvo || !alvo.url) return null;
  await garantirNavegador();
  await pagina.goto(alvo.url, { waitUntil: 'domcontentloaded' });
  // Trava 3: confere se o site nao redirecionou para fora da whitelist.
  return { alvo, dentro: hostPermitido(pagina.url(), sistemas) };
}

// --- Campos de login ---
const SEL_SENHA = 'input[type="password"]';
const SEL_USUARIO =
  'input[type="email"], input[autocomplete="username"], input[type="text"], ' +
  'input[type="tel"], input:not([type])';

async function campoVisivel(seletor) {
  const loc = pagina.locator(seletor);
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    if (await loc.nth(i).isVisible()) return loc.nth(i);
  }
  return null;
}

function seletoresDe(nome) {
  const s = (carregarSistemas()[nome] || {}).seletores || {};
  return { usuario: s.usuario || SEL_USUARIO, senha: s.senha || SEL_SENHA };
}

// --- Estado do pedido de login (o que a IA consegue ver: nunca a senha) ---
// estado: nenhum | aguardando | em_andamento | concluido | cancelado | falhou | expirado
let pedido = { estado: 'nenhum' };
// Conversa de login em curso no Telegram: { nome, etapa: 'usuario'|'senha', timer }
let login = null;

function atualizarPedido(campos) {
  pedido = { ...pedido, ...campos, atualizadoEm: new Date().toISOString() };
}

function encerrarLogin(estado, motivo) {
  if (login) clearTimeout(login.timer);
  login = null;
  atualizarPedido({ estado, motivo, url: pagina ? pagina.url() : undefined });
}

// --- Bot ---
const bot = new TelegramBot(TOKEN, { polling: true });

function autorizado(msg) {
  return msg.from && msg.from.id === ALLOWED_USER_ID;
}

const AJUDA = [
  'Comandos disponiveis:',
  '/sistemas - lista os sistemas conhecidos (whitelist)',
  '/abrir <nome> - abre a sessao salva daquele sistema',
  '/status - manda um print da pagina aberta agora',
  '/login [nome] - faz um login novo: voce manda usuario e senha, eu preencho e apago sua mensagem',
  '/cancelar - cancela o login em andamento',
].join('\n');

// Um /login por vez: um segundo /login enquanto o primeiro abre a pagina
// deixaria dois relogios de 5 minutos e o antigo marcaria "expirado" depois.
let iniciandoLogin = false;

async function iniciarLogin(chatId, nome) {
  if (iniciandoLogin) {
    await bot.sendMessage(chatId, 'Ja estou abrindo um login. Espere a mensagem pedindo o USUARIO.');
    return;
  }
  iniciandoLogin = true;
  try {
    await prepararLogin(chatId, nome);
  } finally {
    iniciandoLogin = false;
  }
}

async function prepararLogin(chatId, nome) {
  if (!nome) {
    await bot.sendMessage(chatId, 'Use assim: /login <nome>. Veja /sistemas.');
    return;
  }
  // Invalida a tentativa anterior antes de trocar de pagina.
  if (login) encerrarLogin('cancelado', 'substituido por um novo /login');
  const aberto = await abrirSistema(nome);
  if (!aberto) {
    await bot.sendMessage(chatId, `Sistema "${nome}" nao esta na whitelist (sistemas.json).`);
    return;
  }
  if (!aberto.dentro) {
    encerrarLogin('falhou', 'redirecionou para fora da whitelist');
    await bot.sendMessage(chatId, `A pagina foi para ${pagina.url()}, fora da whitelist. Nao vou digitar nada la.`);
    return;
  }

  const sel = seletoresDe(nome);
  const temSenha = await campoVisivel(sel.senha);
  const temUsuario = await campoVisivel(sel.usuario);
  if (!temSenha && !temUsuario) {
    encerrarLogin('concluido', 'nenhum campo de login na pagina (ja logado?)');
    const img = await tirarPrint();
    await bot.sendPhoto(chatId, img, {
      caption: `Nao achei campo de login em ${pagina.url()}. Talvez ja esteja logado.`,
    });
    return;
  }

  const tentativa = { nome, etapa: temUsuario ? 'usuario' : 'senha' };
  tentativa.timer = setTimeout(() => {
    if (login !== tentativa) return; // so expira a propria tentativa
    encerrarLogin('expirado', 'sem resposta em 5 minutos');
    bot.sendMessage(chatId, 'Login cancelado: sem resposta em 5 minutos.').catch(() => {});
  }, LOGIN_EXPIRA_MS);
  login = tentativa;
  atualizarPedido({ sistema: nome, estado: 'em_andamento', motivo: undefined });
  await bot.sendMessage(
    chatId,
    `Login em "${nome}" (${hostDe(pagina.url())}).\n` +
      `Envie o ${login.etapa === 'usuario' ? 'USUARIO' : 'SENHA'} numa mensagem. ` +
      'Eu digito no site e apago sua mensagem na hora. /cancelar para desistir.'
  );
}

// Recebe usuario ou senha. O valor so vai para o campo do site.
async function receberCredencial(msg) {
  const chatId = msg.chat.id;
  const valor = msg.text || '';
  const tentativa = login;
  // A tentativa pode ter sido cancelada ou trocada (/cancelar, /login, /abrir)
  // enquanto esperamos o Telegram ou o site: confere antes de cada acao.
  const ativa = () => login === tentativa;
  // Apaga a mensagem antes de qualquer outra coisa.
  await bot.deleteMessage(chatId, msg.message_id).catch(() => {
    bot.sendMessage(chatId, 'Nao consegui apagar sua mensagem: apague-a voce mesmo.').catch(() => {});
  });
  if (tentativa.ocupado) {
    // Ainda processando a etapa anterior: nao arrisca digitar no campo errado.
    await bot.sendMessage(chatId, 'Ainda estou preenchendo a etapa anterior. Espere eu pedir e mande de novo.');
    return;
  }
  if (!ativa()) return;
  tentativa.ocupado = true;

  try {
    // Trava 4: so digita credencial em host da whitelist.
    if (!pagina || !hostPermitido(pagina.url(), carregarSistemas())) {
      encerrarLogin('falhou', 'pagina fora da whitelist');
      await bot.sendMessage(chatId, 'A pagina saiu da whitelist. Login cancelado, nada foi digitado.');
      return;
    }
    const sel = seletoresDe(tentativa.nome);

    if (tentativa.etapa === 'usuario') {
      const campo = await campoVisivel(sel.usuario);
      if (!campo) throw new Error('campo de usuario sumiu');
      if (!ativa()) return;
      await campo.fill(valor);
      if (!(await campoVisivel(sel.senha))) {
        // Login em duas telas (usuario -> avancar -> senha).
        if (!ativa()) return;
        await campo.press('Enter');
        await pagina.locator(sel.senha).first().waitFor({ state: 'visible', timeout: 15000 });
      }
      if (!ativa()) return;
      tentativa.etapa = 'senha';
      await bot.sendMessage(chatId, 'Usuario preenchido. Agora envie a SENHA.');
      return;
    }

    const campo = await campoVisivel(sel.senha);
    if (!campo) throw new Error('campo de senha sumiu');
    if (!ativa()) return;
    await campo.fill(valor);
    if (!ativa()) {
      await campo.fill('').catch(() => {});
      return;
    }
    await campo.press('Enter');
    await pagina.waitForLoadState('domcontentloaded').catch(() => {});
    await pagina.waitForTimeout(3000);
    encerrarLogin('concluido', 'credenciais enviadas ao site; confira o print');
    const img = await tirarPrint();
    await bot.sendPhoto(chatId, img, { caption: `Login enviado em "${tentativa.nome}". Agora em: ${pagina.url()}` });
  } catch (err) {
    // Sem detalhes do erro: a mensagem poderia conter o que foi digitado.
    console.error('login falhou:', err.name);
    if (!ativa()) return;
    encerrarLogin('falhou', 'erro ao preencher o formulario');
    await bot.sendMessage(chatId, 'Nao consegui preencher o login. Use /status para ver a pagina e tente /login de novo.');
  } finally {
    tentativa.ocupado = false;
  }
}

bot.on('message', async (msg) => {
  // Trava 1: so o dono pode usar. Outros sao ignorados em silencio.
  if (!autorizado(msg)) return;

  const chatId = msg.chat.id;
  const texto = (msg.text || '').trim();

  // Durante um /login, a proxima mensagem que nao e comando e a credencial.
  if (login && msg.text && !texto.startsWith('/')) {
    await receberCredencial(msg);
    return;
  }

  try {
    if (texto === '/start' || texto === '/help') {
      await bot.sendMessage(chatId, AJUDA);
      return;
    }

    if (texto === '/sistemas') {
      const sistemas = carregarSistemas();
      const nomes = Object.keys(sistemas);
      if (nomes.length === 0) {
        await bot.sendMessage(chatId, 'Nenhum sistema cadastrado em sistemas.json.');
        return;
      }
      const lista = nomes
        .map((n) => `- ${n}: ${sistemas[n].descricao || sistemas[n].url}`)
        .join('\n');
      await bot.sendMessage(chatId, `Sistemas conhecidos:\n${lista}`);
      return;
    }

    if (texto === '/status') {
      if (!contexto) {
        await bot.sendMessage(chatId, 'Nenhuma pagina aberta ainda. Use /abrir <nome>.');
        return;
      }
      const img = await tirarPrint();
      await bot.sendPhoto(chatId, img, { caption: `Agora em: ${pagina.url()}` });
      return;
    }

    if (texto === '/cancelar') {
      if (!login && pedido.estado !== 'aguardando') {
        await bot.sendMessage(chatId, 'Nao ha login em andamento.');
        return;
      }
      encerrarLogin('cancelado', 'cancelado por voce');
      await bot.sendMessage(chatId, 'Login cancelado.');
      return;
    }

    if (texto.startsWith('/login')) {
      const nome = texto.split(/\s+/)[1] || (pedido.estado === 'aguardando' ? pedido.sistema : null);
      await iniciarLogin(chatId, nome);
      return;
    }

    if (texto.startsWith('/abrir')) {
      const nome = texto.split(/\s+/)[1];
      if (!nome) {
        await bot.sendMessage(chatId, 'Use assim: /abrir <nome>. Veja /sistemas.');
        return;
      }
      if (login) {
        encerrarLogin('cancelado', 'voce abriu outra pagina');
        await bot.sendMessage(chatId, 'Login em andamento cancelado.');
      }
      const aberto = await abrirSistema(nome);
      if (!aberto) {
        await bot.sendMessage(chatId, `Sistema "${nome}" nao esta na whitelist (sistemas.json).`);
        return;
      }
      const aviso = aberto.dentro
        ? ''
        : '\nAVISO: a pagina redirecionou para fora da whitelist. Confira antes de agir.';

      const img = await tirarPrint();
      await bot.sendPhoto(chatId, img, { caption: `Abri "${nome}" em ${pagina.url()}${aviso}` });
      return;
    }

    await bot.sendMessage(chatId, `Nao entendi.\n\n${AJUDA}`);
  } catch (err) {
    // Nunca imprime token nem conteudo sensivel; so a mensagem do erro.
    await bot.sendMessage(chatId, `Deu erro ao processar: ${err.message}`);
  }
});

bot.on('polling_error', (err) => {
  console.error('polling_error:', err.code || err.message);
});

// --- Porta de controle local: a IA pede um login e acompanha o resultado ---
//   POST /pedir-login  {"sistema":"<nome>","motivo":"..."}  -> avisa voce no Telegram
//   GET  /estado                                            -> estado do pedido (sem senha)
function responder(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
}

const hostsLocais = new Set([`127.0.0.1:${CONTROLE_PORTA}`, `localhost:${CONTROLE_PORTA}`]);

const servidor = http.createServer((req, res) => {
  // Trava 5: so chamadas locais de programas, nunca de uma pagina web
  // (bloqueia DNS rebinding pelo Host e sites abertos no navegador pelo Origin).
  if (!hostsLocais.has(req.headers.host) || req.headers.origin) {
    responder(res, 403, { erro: 'proibido' });
    return;
  }

  if (req.method === 'GET' && req.url === '/estado') {
    const { sistema, estado, motivo, url, atualizadoEm } = pedido;
    responder(res, 200, { sistema, estado, motivo, url, atualizadoEm });
    return;
  }

  if (req.method === 'POST' && req.url === '/pedir-login') {
    if (!String(req.headers['content-type'] || '').startsWith('application/json')) {
      responder(res, 415, { erro: 'use Content-Type: application/json' });
      return;
    }
    let corpo = '';
    req.on('data', (parte) => {
      corpo += parte;
      if (corpo.length > 10000) req.destroy();
    });
    req.on('end', async () => {
      let dados;
      try {
        dados = JSON.parse(corpo);
      } catch {
        responder(res, 400, { erro: 'JSON invalido' });
        return;
      }
      const nome = String(dados.sistema || '');
      const alvo = carregarSistemas()[nome];
      if (!alvo || !alvo.url) {
        responder(res, 404, { erro: `sistema "${nome}" nao esta na whitelist` });
        return;
      }
      if (login) {
        responder(res, 409, { erro: 'ja existe um login em andamento', estado: pedido.estado });
        return;
      }
      const motivo = String(dados.motivo || '').slice(0, 200);
      pedido = { sistema: nome };
      atualizarPedido({ estado: 'aguardando', motivo: motivo || undefined });
      try {
        await bot.sendMessage(
          ALLOWED_USER_ID,
          `A IA precisa de um login novo em "${nome}" (${hostDe(alvo.url)}).` +
            (motivo ? `\nMotivo: ${motivo}` : '') +
            '\n\nEnvie /login para comecar (voce manda usuario e senha aqui; eu apago as mensagens) ou /cancelar.'
        );
        responder(res, 202, { estado: 'aguardando', sistema: nome });
      } catch (err) {
        atualizarPedido({ estado: 'falhou', motivo: 'nao consegui avisar no Telegram' });
        responder(res, 502, { erro: 'nao consegui avisar no Telegram' });
      }
    });
    return;
  }

  responder(res, 404, { erro: 'rota desconhecida' });
});

if (CONTROLE_PORTA > 0) {
  servidor.listen(CONTROLE_PORTA, '127.0.0.1', () => {
    console.log(`Porta de controle: http://127.0.0.1:${CONTROLE_PORTA}`);
  });
}

console.log(
  'Bot remoto no ar. Perfil:', PROFILE_DIR, '| headless:', HEADLESS,
  '| CDP:', CDP_PORTA > 0 ? `127.0.0.1:${CDP_PORTA}` : 'desligado'
);
