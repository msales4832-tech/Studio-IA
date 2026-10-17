'use strict';

// Bot de Telegram para administracao remota das SUAS sessoes ja autenticadas.
//
// Principios de seguranca desta ferramenta:
//  - NAO recebe, guarda nem trafega senhas. Voce loga uma vez na janela do
//    navegador; os cookies ficam salvos no perfil persistente ./browser-profile.
//  - So responde ao SEU usuario (TELEGRAM_ALLOWED_USER_ID). Qualquer outra
//    pessoa e ignorada.
//  - So abre URLs que estao na whitelist sistemas.json. Sites novos nao sao
//    abertos automaticamente.
//  - O token e lido do .env (nunca fica escrito no codigo).

const path = require('path');
const fs = require('fs');
const TelegramBot = require('node-telegram-bot-api');
const { chromium } = require('playwright');

const PROFILE_DIR = path.join(__dirname, 'browser-profile');
const SISTEMAS_PATH = path.join(__dirname, 'sistemas.json');

// --- Configuracao obrigatoria, vinda do .env ---
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_USER_ID = Number(process.env.TELEGRAM_ALLOWED_USER_ID);
const HEADLESS = process.env.HEADLESS === 'true';

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

// --- Navegador (perfil persistente, carregado so quando precisa) ---
let contexto = null;
let pagina = null;

async function garantirNavegador() {
  if (contexto) return;
  contexto = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: HEADLESS,
  });
  pagina = contexto.pages()[0] || (await contexto.newPage());
}

async function tirarPrint() {
  await garantirNavegador();
  return pagina.screenshot({ fullPage: false });
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
].join('\n');

bot.on('message', async (msg) => {
  // Trava 1: so o dono pode usar. Outros sao ignorados em silencio.
  if (!autorizado(msg)) return;

  const chatId = msg.chat.id;
  const texto = (msg.text || '').trim();

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

    if (texto.startsWith('/abrir')) {
      const nome = texto.split(/\s+/)[1];
      if (!nome) {
        await bot.sendMessage(chatId, 'Use assim: /abrir <nome>. Veja /sistemas.');
        return;
      }
      const sistemas = carregarSistemas();
      const alvo = sistemas[nome];
      if (!alvo || !alvo.url) {
        await bot.sendMessage(chatId, `Sistema "${nome}" nao esta na whitelist (sistemas.json).`);
        return;
      }

      await garantirNavegador();
      await pagina.goto(alvo.url, { waitUntil: 'domcontentloaded' });

      // Trava 3: confere se o site nao redirecionou para fora da whitelist.
      const hostsPermitidos = new Set(
        Object.values(sistemas).map((s) => hostDe(s.url)).filter(Boolean)
      );
      const hostAtual = hostDe(pagina.url());
      const aviso = hostsPermitidos.has(hostAtual)
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

console.log('Bot remoto no ar. Perfil:', PROFILE_DIR, '| headless:', HEADLESS);
