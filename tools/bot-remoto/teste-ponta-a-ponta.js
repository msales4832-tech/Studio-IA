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
    message: { message_id: id, from: { id: deQuem }, chat: { id: deQuem, type: 'private' }, date: Math.floor(Date.now() / 1000), text: texto },
  });
  return id;
}

const AUDIO_FALSO = Buffer.from('OggS-audio-de-teste');
const gemini = []; // pedidos que chegaram ao Gemini falso

function mandarAudio(deQuem) {
  fila.push({
    update_id: proximoUpdate++,
    message: {
      message_id: proximaMsg++, from: { id: deQuem }, chat: { id: deQuem, type: 'private' },
      date: Math.floor(Date.now() / 1000),
      voice: { file_id: 'voz1', duration: 3, mime_type: 'audio/ogg', file_size: AUDIO_FALSO.length },
    },
  });
}

function apertarBotao(deQuem, dados) {
  fila.push({
    update_id: proximoUpdate++,
    callback_query: {
      id: `cb${proximoUpdate}`,
      from: { id: deQuem },
      message: { message_id: 1, chat: { id: deQuem, type: 'private' }, date: 0 },
      data: dados,
    },
  });
}

// Claude falso: pede aprovacao ao porteiro (MCP de verdade) para criar o
// arquivo citado no pedido e so cria se aprovado.
const AGENTE_FALSO = `
const fs = require('fs'); const { spawn } = require('child_process');
let pedido = ''; process.stdin.on('data', (p) => (pedido += p));
process.stdin.on('end', () => {
  const a = process.argv; const cfg = JSON.parse(fs.readFileSync(a[a.indexOf('--mcp-config') + 1], 'utf8'));
  const s = cfg.mcpServers.aprovacao;
  const mcp = spawn(s.command, s.args, { env: { ...process.env, ...s.env } });
  const arquivo = (/(\\S+\\.txt)/.exec(pedido) || [])[1];
  let buf = '';
  mcp.stdout.on('data', (p) => {
    buf += p; let i;
    while ((i = buf.indexOf('\\n')) >= 0) {
      const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
      if (m.id === 1) mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: { name: 'pedir', arguments: { tool_name: 'Bash', input: { command: 'criar ' + arquivo } } } }) + '\\n');
      if (m.id === 2) {
        const d = JSON.parse(m.result.content[0].text); mcp.kill();
        if (d.behavior === 'allow') fs.writeFileSync(arquivo, 'Comando recebido pelo Telegram');
        console.log(JSON.stringify({ type: 'result', is_error: false,
          result: d.behavior === 'allow' ? 'Criei ' + arquivo : 'Nao criei ' + arquivo,
          permission_denials: d.behavior === 'allow' ? [] : [{ tool_name: 'Bash' }] }));
      }
    }
  });
  mcp.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\\n');
});`;

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
    // Download do audio (arquivo do Telegram) e Gemini falso.
    if (rota.endsWith('/voz/audio.ogg')) {
      res.writeHead(200, { 'Content-Type': 'audio/ogg' });
      res.end(AUDIO_FALSO);
      return;
    }
    if (metodo.endsWith(':generateContent')) {
      const pedido = JSON.parse(corpo.toString());
      const parte = pedido.contents[0].parts.find((p) => p.inline_data) || {};
      gemini.push({ chave: req.headers['x-goog-api-key'], tipo: (parte.inline_data || {}).mime_type, dados: (parte.inline_data || {}).data });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Crie o arquivo audio-teste.txt' }] } }] }));
      return;
    }
    if (metodo === 'getFile') {
      result = { file_id: dados.file_id, file_path: 'voz/audio.ogg' };
    } else if (metodo === 'getUpdates') {
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
  fs.copyFileSync(path.join(__dirname, 'aprovacao-mcp.js'), path.join(tmp, 'aprovacao-mcp.js'));
  fs.writeFileSync(path.join(tmp, 'agente-falso.js'), AGENTE_FALSO);
  const tarefasDir = path.join(tmp, 'tarefas');
  // Aponta a biblioteca do Telegram para o Telegram falso.
  fs.writeFileSync(
    path.join(tmp, 'telegram-falso.js'),
    `const M = require('module'); const real = require('node-telegram-bot-api');
     class Falso extends real { constructor(t, o) { super(t, { ...o, baseApiUrl: ${JSON.stringify(apiUrl)} }); } }
     const load = M._load; M._load = function (p, ...r) { return p === 'node-telegram-bot-api' ? Falso : load.call(this, p, ...r); };
     const cp = require('child_process'); const sp = cp.spawn;
     cp.spawn = (c, a, o) => c === 'claude-falso' ? sp(process.execPath, [require('path').join(__dirname, 'agente-falso.js'), ...a], o) : sp(c, a, o);`
  );

  // Ordem antiga parada na fila do Telegram (enviada com o bot fora do ar).
  fila.push({ update_id: proximoUpdate++, message: { message_id: 1, from: { id: DONO }, chat: { id: DONO, type: 'private' }, date: Math.floor(Date.now() / 1000) - 600, text: 'Crie o arquivo ordem-antiga.txt' } });

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
      CLAUDE_EXE: 'claude-falso',
      GEMINI_API_URL: apiUrl,
      GEMINI_API_KEY: 'CHAVE-FALSA-DE-TESTE',
      TAREFAS_DIR: tarefasDir,
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

    // 1b. Trava: ordem antiga da fila nao vira tarefa.
    confere('mensagem antiga da fila e ignorada', !!(await esperarChamada(0, (c) => /Ignorei uma mensagem enviada antes/.test(c.text || ''))) && !chamadas.some((c) => /^Recebi\./.test(c.text || '')));

    // 2. Trava: pagina web (com Origin) nao consegue usar a porta de controle.
    const web = await controle('GET', '/estado', null, { Origin: 'https://site-malicioso.com' });
    confere('porta de controle recusa chamada vinda de site', web.status === 403);

    // 3. Trava: estranho e ignorado.
    let n = chamadas.length;
    mandarAoBot(INTRUSO, '/sistemas');
    await espera(2000);
    confere('bot ignora quem nao e o dono', chamadas.slice(n).length === 0);

    // 3b. Trava: o dono escrevendo num grupo e ignorado (la a senha do /login ficaria visivel).
    n = chamadas.length;
    fila.push({ update_id: proximoUpdate++, message: { message_id: proximaMsg++, from: { id: DONO }, chat: { id: -500, type: 'group' }, date: Math.floor(Date.now() / 1000), text: '/sistemas' } });
    await espera(2000);
    confere('bot ignora o dono em grupo', chamadas.slice(n).length === 0);

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

    // 9. Tarefa livre com aprovacao: texto -> Claude -> botao -> resultado.
    const semSegredo = await controle('POST', '/pedir-aprovacao', '{}', { 'Content-Type': 'application/json' });
    confere('porteiro recusa pedido sem o segredo', semSegredo.status === 403);

    n = chamadas.length;
    mandarAoBot(DONO, 'Crie o arquivo teste-telegram.txt com o conteudo "Comando recebido pelo Telegram"');
    confere('texto livre vira tarefa (bot confirma)', !!(await esperarChamada(n, (c) => /^Recebi\./.test(c.text || ''))));
    const pergunta = await esperarChamada(n, (c) => /quer usar Bash/.test(c.text || '') && c.reply_markup);
    const idAprov = pergunta && (/"ok:(\d+)"/.exec(pergunta.reply_markup) || [])[1];
    confere('pedido de aprovacao chega com botoes', !!idAprov, pergunta ? pergunta.text.split('\n')[0] : '');

    n = chamadas.length;
    apertarBotao(INTRUSO, `ok:${idAprov}`);
    await espera(1500);
    confere('botao de estranho e ignorado', chamadas.slice(n).length === 0);

    apertarBotao(DONO, `ok:${idAprov}`);
    const pronto = await esperarChamada(n, (c) => /^Pronto:/.test(c.text || ''));
    confere('resultado volta ao Telegram', !!pronto, pronto ? pronto.text.replace(/\n/g, ' ') : '');
    const criado = path.join(tarefasDir, 'teste-telegram.txt');
    const conteudo = fs.existsSync(criado) ? fs.readFileSync(criado, 'utf8') : '';
    confere('arquivo criado com o conteudo pedido', conteudo === 'Comando recebido pelo Telegram', conteudo);

    n = chamadas.length;
    apertarBotao(DONO, `ok:${idAprov}`);
    confere(
      'botao ja usado nao vale de novo',
      !!(await esperarChamada(n, (c) => c.metodo === 'answerCallbackQuery' && /ja foi decidido/.test(c.text || '')))
    );

    n = chamadas.length;
    mandarAoBot(DONO, 'Crie o arquivo teste-negado.txt');
    const pergunta2 = await esperarChamada(n, (c) => /quer usar Bash/.test(c.text || '') && c.reply_markup);
    const idAprov2 = pergunta2 && (/"nao:(\d+)"/.exec(pergunta2.reply_markup) || [])[1];
    apertarBotao(DONO, `nao:${idAprov2}`);
    const negado = await esperarChamada(n, (c) => /^Pronto:/.test(c.text || ''));
    confere(
      'negar impede a acao e o resultado avisa',
      !!negado && /negada/.test(negado.text) && !fs.existsSync(path.join(tarefasDir, 'teste-negado.txt')),
      negado ? negado.text.replace(/\n/g, ' ') : ''
    );

    // 10. Audio: Telegram -> Gemini -> "Entendi" -> tarefa -> botao -> arquivo.
    n = chamadas.length;
    mandarAudio(DONO);
    const entendi = await esperarChamada(n, (c) => /^Entendi:/.test(c.text || ''));
    confere('audio transcrito e mostrado', !!entendi, entendi ? entendi.text : '');
    const g = gemini[0] || {};
    confere(
      'audio foi ao Gemini com a chave, tipo e conteudo certos',
      g.chave === 'CHAVE-FALSA-DE-TESTE' && g.tipo === 'audio/ogg' && Buffer.from(g.dados || '', 'base64').equals(AUDIO_FALSO)
    );
    const pergunta3 = await esperarChamada(n, (c) => /quer usar Bash/.test(c.text || '') && c.reply_markup);
    const idAprov3 = pergunta3 && (/"ok:(\d+)"/.exec(pergunta3.reply_markup) || [])[1];
    apertarBotao(DONO, `ok:${idAprov3}`);
    const pronto3 = await esperarChamada(n, (c) => /^Pronto:/.test(c.text || ''));
    confere(
      'audio vira tarefa e o arquivo e criado',
      !!pronto3 && fs.existsSync(path.join(tarefasDir, 'audio-teste.txt')),
      pronto3 ? pronto3.text.replace(/\n/g, ' ') : ''
    );
    n = chamadas.length;
    mandarAudio(INTRUSO);
    await espera(1500);
    confere('audio de estranho e ignorado', chamadas.slice(n).length === 0 && gemini.length === 1);

    // 11. A senha nao vazou em nenhum lugar.
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
