'use strict';

// Site falso de login, so para testar o /login do bot. Nao e conta real.
// Uso: node pagina-teste.js   ->  http://127.0.0.1:18080/login
// Dados ficticios: usuario teste@exemplo.com | senha Senha-Teste-123

const http = require('http');
const crypto = require('crypto');

const PORTA = 18080;
const USUARIO = 'teste@exemplo.com';
const SENHA = 'Senha-Teste-123';
const sessoes = new Map(); // id da sessao -> usuario

function pagina(res, status, corpo) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    '<!doctype html><meta charset="utf-8"><title>Login de teste</title>' +
      '<body style="font-family:sans-serif;max-width:360px;margin:40px auto">' +
      corpo +
      '</body>'
  );
}

function formulario(aviso) {
  return (
    '<h1>Login de teste</h1>' +
    (aviso ? `<p id="aviso" style="color:#b00">${aviso}</p>` : '') +
    '<form method="post" action="/entrar">' +
    '<p><label>Usuario<br><input name="usuario" type="email" autocomplete="username"></label></p>' +
    '<p><label>Senha<br><input name="senha" type="password" autocomplete="current-password"></label></p>' +
    '<button type="submit">Entrar</button></form>'
  );
}

function sessaoDe(req) {
  const m = /(?:^|;\s*)sessao=([a-f0-9]+)/.exec(req.headers.cookie || '');
  return m ? sessoes.get(m[1]) : undefined;
}

http
  .createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (req.method === 'POST' && url === '/entrar') {
      let corpo = '';
      req.on('data', (p) => (corpo += p));
      req.on('end', () => {
        const dados = new URLSearchParams(corpo);
        if (dados.get('usuario') !== USUARIO || dados.get('senha') !== SENHA) {
          console.log(new Date().toISOString(), 'login recusado');
          pagina(res, 401, formulario('Usuario ou senha incorretos.'));
          return;
        }
        const id = crypto.randomBytes(16).toString('hex');
        sessoes.set(id, USUARIO);
        console.log(new Date().toISOString(), 'login aceito');
        res.writeHead(303, { 'Set-Cookie': `sessao=${id}; HttpOnly; Path=/`, Location: '/painel' });
        res.end();
      });
      return;
    }

    if (url === '/painel') {
      const usuario = sessaoDe(req);
      if (!usuario) {
        res.writeHead(303, { Location: '/login' });
        res.end();
        return;
      }
      pagina(res, 200, `<h1 id="painel">Painel de teste</h1><p id="logado">Logado como ${usuario}</p>`);
      return;
    }

    if (url === '/login' || url === '/') {
      if (sessaoDe(req)) {
        res.writeHead(303, { Location: '/painel' });
        res.end();
        return;
      }
      pagina(res, 200, formulario());
      return;
    }

    pagina(res, 404, '<p>Pagina nao encontrada.</p>');
  })
  .listen(PORTA, '127.0.0.1', () => {
    console.log(`Pagina de teste em http://127.0.0.1:${PORTA}/login`);
  });
