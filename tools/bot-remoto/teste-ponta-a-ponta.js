'use strict';

// Teste de ponta a ponta do bot, sem celular e sem Telegram de verdade.
// Roda o bot_remoto.js de verdade contra um "Telegram falso" local e a
// pagina-teste.js, faz o login pelo fluxo da IA (/pedir-login -> /login ->
// usuario -> senha) e confere cada passo. Nao usa o seu token nem o seu perfil
// do navegador: copia o bot para uma pasta temporaria.
// Uso: npm test   (salva os prints em ./prova-teste)

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DONO = 111;
const INTRUSO = 999;
const USUARIO = 'teste@exemplo.com';
const SENHA = 'Senha-Teste-123';
const PORTA_CONTROLE = 18765;
const PROVA_DIR = path.join(__dirname, 'prova-teste');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const resultados = [];
function confere(nome, ok, detalhe = '') {
  resultados.push(ok);
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ' - ' + detalhe : ''}`);
}

// --- Telegram falso: guarda o que o bot manda e entrega as nossas mensagens ---
const chamadas = [];
const fila = [];
let proximoUpdate = 1;
let proximaMsg = 1000;

function mandarAoBot(deQuem, texto) {
  const id = proximaMsg++;
  fila.push({
    update_id: proximoUpdate++,
    message: { message_id: id, from: { id: deQuem }, chat: { id: deQuem, type: 'private' }, date: 0, text: texto },
  });
  return id;
}

function pngDe(corpo) {
  const ini = corpo.indexOf(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const fim = corpo.indexOf(Buffer.from('IEND'));
  return ini >= 0 && fim > ini ? corpo.subarray(ini, fim + 8) : null;
}

const telegram = http.createServer((req, res) => {
  const partes = [];
  req.on('data', (p) => partes.push(p));
  req.on('end', () => {
    const corpo = Buffer.concat(partes);
    const [rota, query = ''] = req.url.split('?');
    const metodo = rota.split('/').pop();
    const tipo = req.headers['content-type'] || '';
    // A biblioteca manda os campos no corpo ou, junto com arquivo, no endereco.
    const dados = tipo.startsWith('multipart')
      ? { ...Object.fromEntries(new URLSearchParams(query)), foto: pngDe(corpo) }
      : Object.fromEntries(new URLSearchParams(corpo.toString()));
    let result = true;
    if (metodo === 'getUpdates') {
      const offset = Number(dados.offset || 0);
      result = fila.filter((u) => u.update_id >= offset);
    } else {
      chamadas.push({ metodo, ...dados });
      if (metodo === 'sendMessage' || metodo === 'sendPhoto') {
        result = { message_id: proximaMsg++, chat: { id: Number(dados.chat_id) }, date: 0, text: dados.text };
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, result }));
  });
});

// Espera o bot fazer uma chamada que combine com o filtro (a partir de "desde").
async function esperarChamada(desde, filtro, ms = 30000) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const achou = chamadas.slice(desde).find(filtro);
    if (achou) return achou;
    await espera(200);
  }
  return null;
}

function controle(metodo, rota, corpo, cabecalhos = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: PORTA_CONTROLE, method: metodo, path: rota, headers: cabecalhos },
      (res) => {
        let txt = '';
        res.on('data', (p) => (txt += p));
        res.on('end', () => resolve({ status: res.statusCode, texto: txt, json: JSON.parse(txt || '{}') }));
      }
    );
    req.on('error', reject);
    if (corpo) req.write(corpo);
    req.end();
  });
}

function paginaTesteNoAr() {
  return new Promise((resolve) => {
    http.get('http://127.0.0.1:18080/login', (r) => (r.resume(), resolve(true))).on('error', () => resolve(false));
  });
}

async function main() {
  fs.mkdirSync(PROVA_DIR, { recursive: true });
  const filhos = [];

  // Pagina de login de teste (reaproveita se ja estiver rodando).
  if (!(await paginaTesteNoAr())) {
    filhos.push(spawn(process.execPath, [path.join(__dirname, 'pagina-teste.js')], { stdio: 'ignore' }));
    await espera(1000);
  }
  confere('pagina de login de teste no ar', await paginaTesteNoAr());

  await new Promise((r) => telegram.listen(0, '127.0.0.1', r));
  const apiUrl = `http://127.0.0.1:${telegram.address().port}`;

  // Copia do bot numa pasta temporaria: perfil do navegador novo e vazio.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-remoto-teste-'));
  fs.copyFileSync(path.join(__dirname, 'bot_remoto.js'), path.join(tmp, 'bot_remoto.js'));
  fs.copyFileSync(path.join(__dirname, 'sistemas.json'), path.join(tmp, 'sistemas.json'));
  // Aponta a biblioteca do Telegram para o Telegram falso.
  fs.writeFileSync(
    path.join(tmp, 'telegram-falso.js'),
    `const M = require('module'); const real = require('node-telegram-bot-api');
     class Falso extends real { constructor(t, o) { super(t, { ...o, baseApiUrl: ${JSON.stringify(apiUrl)} }); } }
     const load = M._load; M._load = function (p, ...r) { return p === 'node-telegram-bot-api' ? Falso : load.call(this, p, ...r); };`
  );

  let saida = '';
  const bot = spawn(process.execPath, ['-r', './telegram-falso.js', 'bot_remoto.js'], {
    cwd: tmp,
    env: {
      ...process.env,
      NODE_PATH: path.join(__dirname, 'node_modules'),
      TELEGRAM_BOT_TOKEN: '123:TOKEN-FALSO-DE-TESTE',
      TELEGRAM_ALLOWED_USER_ID: String(DONO),
      HEADLESS: 'true',
      CONTROLE_PORTA: String(PORTA_CONTROLE),
      CDP_PORTA: '0',
    },
  });
  filhos.push(bot);
  bot.stdout.on('data', (p) => (saida += p));
  bot.stderr.on('data', (p) => (saida += p));

  try {
    // 1. Bot no ar.
    let estado;
    for (let i = 0; i < 50 && !estado; i++) {
      await espera(200);
      estado = await controle('GET', '/estado', null, { Host: `127.0.0.1:${PORTA_CONTROLE}` }).catch(() => null);
    }
    confere('bot ligou e a porta de controle responde', estado && estado.json.estado === 'nenhum');

    // 2. Trava: pagina web (com Origin) nao consegue usar a porta de controle.
    const web = await controle('GET', '/estado', null, { Origin: 'https://site-malicioso.com' });
    confere('porta de controle recusa chamada vinda de site', web.status === 403);

    // 3. Trava: estranho e ignorado.
    let n = chamadas.length;
    mandarAoBot(INTRUSO, '/sistemas');
    await espera(2000);
    confere('bot ignora quem nao e o dono', chamadas.slice(n).length === 0);

    // 4. Trava: site fora da whitelist.
    n = chamadas.length;
    mandarAoBot(DONO, '/abrir banco-qualquer');
    confere('recusa sistema fora da whitelist', !!(await esperarChamada(n, (c) => /nao esta na whitelist/.test(c.text || ''))));

    // 5. A IA pede o login.
    n = chamadas.length;
    const pedido = await controle('POST', '/pedir-login', JSON.stringify({ sistema: 'teste', motivo: 'teste automatico' }), {
      'Content-Type': 'application/json',
    });
    confere('IA pede login (/pedir-login)', pedido.status === 202, `resposta ${pedido.status}`);
    const aviso = await esperarChamada(n, (c) => /precisa de um login novo/.test(c.text || ''));
    confere('dono recebe o aviso no Telegram', !!aviso && Number(aviso.chat_id) === DONO);
    estado = await controle('GET', '/estado');
    confere('estado = aguardando', estado.json.estado === 'aguardando');

    // 6. Dono manda /login, usuario e senha.
    n = chamadas.length;
    mandarAoBot(DONO, '/login');
    confere('bot pede o USUARIO', !!(await esperarChamada(n, (c) => /USUARIO/.test(c.text || ''), 60000)));

    n = chamadas.length;
    const idUsuario = mandarAoBot(DONO, USUARIO);
    const apagouU = await esperarChamada(n, (c) => c.metodo === 'deleteMessage' && Number(c.message_id) === idUsuario);
    confere('mensagem do usuario apagada', !!apagouU);
    confere('bot pede a SENHA', !!(await esperarChamada(n, (c) => /envie a SENHA/.test(c.text || ''))));

    n = chamadas.length;
    const idSenha = mandarAoBot(DONO, SENHA);
    const apagouS = await esperarChamada(n, (c) => c.metodo === 'deleteMessage' && Number(c.message_id) === idSenha);
    confere('mensagem da SENHA apagada', !!apagouS);
    const foto = await esperarChamada(n, (c) => c.metodo === 'sendPhoto', 60000);
    confere('print do resultado chegou', !!(foto && foto.foto), foto ? foto.caption : 'sem foto');
    confere('login aceito: caiu no /painel', !!foto && /\/painel/.test(foto.caption || ''));
    if (foto && foto.foto) fs.writeFileSync(path.join(PROVA_DIR, '1-depois-do-login.png'), foto.foto);

    // 7. A IA ve o estado, nunca a senha.
    estado = await controle('GET', '/estado');
    confere('estado = concluido', estado.json.estado === 'concluido', estado.texto);
    confere('estado nao contem a senha', !estado.texto.includes(SENHA));

    // 8. /status manda um print da pagina logada.
    n = chamadas.length;
    mandarAoBot(DONO, '/status');
    const status = await esperarChamada(n, (c) => c.metodo === 'sendPhoto');
    confere('/status manda print', !!(status && status.foto), status ? status.caption : '');
    if (status && status.foto) fs.writeFileSync(path.join(PROVA_DIR, '2-status.png'), status.foto);

    // 9. A senha nao vazou em nenhum lugar.
    const tudoQueSaiu = JSON.stringify(chamadas.map(({ foto: _f, ...c }) => c));
    confere('senha nunca foi mandada de volta ao Telegram', !tudoQueSaiu.includes(SENHA));
    confere('senha nao aparece no log do bot', !saida.includes(SENHA));
    fs.writeFileSync(path.join(PROVA_DIR, 'mensagens-do-bot.json'), JSON.stringify(chamadas.map(({ foto: f, ...c }) => ({ ...c, foto: f ? `${f.length} bytes` : undefined })), null, 2));
  } finally {
    for (const f of filhos) f.kill();
    telegram.close();
    await espera(500);
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }

  const falhas = resultados.filter((ok) => !ok).length;
  console.log(`\n${resultados.length - falhas}/${resultados.length} conferencias OK. Prints em ${PROVA_DIR}`);
  if (falhas) {
    console.log('\nLog do bot:\n' + saida);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Erro no teste:', err);
  process.exit(1);
});
