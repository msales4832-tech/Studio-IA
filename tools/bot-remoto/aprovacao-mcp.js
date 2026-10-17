'use strict';

// Porteiro de permissoes do Claude (servidor MCP minimo, via stdin/stdout).
// O bot passa este arquivo ao `claude -p --permission-prompt-tool`. Quando o
// Claude quer fazer algo que precisa de permissao, chama a ferramenta "pedir";
// ela pergunta ao bot (porta local) e o bot pergunta a voce no Telegram, com
// botoes ligados a ESTA acao. Sem resposta ou sem bot: nega.

const http = require('http');
const readline = require('readline');

const PORTA = Number(process.env.CONTROLE_PORTA || 8765);
const SEGREDO = process.env.BOT_APROVACAO_SEGREDO || '';

function perguntarAoBot(ferramenta, entrada) {
  return new Promise((resolve) => {
    const corpo = JSON.stringify({ ferramenta, entrada });
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORTA,
        method: 'POST',
        path: '/pedir-aprovacao',
        headers: { 'Content-Type': 'application/json', 'X-Segredo': SEGREDO },
      },
      (res) => {
        let txt = '';
        res.on('data', (p) => (txt += p));
        res.on('end', () => {
          try {
            resolve(res.statusCode === 200 && JSON.parse(txt).aprovado === true);
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on('error', () => resolve(false));
    req.end(corpo);
  });
}

function enviar(msg) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...msg }) + '\n');
}

const FERRAMENTA = {
  name: 'pedir',
  description: 'Pede ao dono, pelo Telegram, permissao para uma acao.',
  inputSchema: {
    type: 'object',
    properties: { tool_name: { type: 'string' }, input: { type: 'object' }, tool_use_id: { type: 'string' } },
    required: ['tool_name', 'input'],
  },
};

readline.createInterface({ input: process.stdin }).on('line', async (linha) => {
  let msg;
  try {
    msg = JSON.parse(linha);
  } catch {
    return;
  }
  if (msg.id === undefined) return; // notificacoes nao tem resposta

  if (msg.method === 'initialize') {
    enviar({
      id: msg.id,
      result: {
        protocolVersion: (msg.params && msg.params.protocolVersion) || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'aprovacao', version: '1.0.0' },
      },
    });
  } else if (msg.method === 'tools/list') {
    enviar({ id: msg.id, result: { tools: [FERRAMENTA] } });
  } else if (msg.method === 'tools/call' && msg.params && msg.params.name === 'pedir') {
    const { tool_name: ferramenta, input: entrada = {} } = msg.params.arguments || {};
    const aprovado = await perguntarAoBot(ferramenta, entrada);
    const decisao = aprovado
      ? { behavior: 'allow', updatedInput: entrada }
      : { behavior: 'deny', message: 'O dono negou (ou nao respondeu) no Telegram.' };
    enviar({ id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(decisao) }] } });
  } else {
    enviar({ id: msg.id, error: { code: -32601, message: 'metodo desconhecido' } });
  }
});
