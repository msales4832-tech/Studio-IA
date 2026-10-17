# Bot remoto (administração das suas sessões via Telegram)

Ferramenta pessoal para você, pelo celular, pedir um print (`/status`) ou abrir
um sistema já logado (`/abrir <nome>`) no navegador do seu PC — **sem trafegar
senhas**. Você loga uma vez na janela do navegador e os cookies ficam salvos no
perfil persistente `browser-profile/`.

## Importante: onde isso roda

Isto roda **no seu PC** (não na nuvem). O bot controla o navegador da sua
máquina; se rodasse num container temporário, morreria e não veria suas sessões.

## Passo a passo (no seu PC)

1. Abra o terminal nesta pasta:
   `cd tools/bot-remoto`
2. Instale as dependências (uma vez só):
   `npm install`
   `npx playwright install chromium`
3. Crie o seu `.env` a partir do exemplo e preencha:
   `cp .env.example .env`
   - `TELEGRAM_BOT_TOKEN`: pegue com o @BotFather. **Se o token já apareceu em
     algum chat ou print, gere um novo** (@BotFather → `/revoke`).
   - `TELEGRAM_ALLOWED_USER_ID`: seu ID numérico (envie `/start` ao @userinfobot).
4. Cadastre seus sistemas em `sistemas.json` (nome → url). Só URLs listadas aqui
   podem ser abertas (whitelist).
5. Ligue o bot:
   `npm start`
   - Na primeira vez, a janela do navegador abre (`HEADLESS=false`): **faça o
     login manualmente** nos seus sistemas. Os cookies ficam salvos.
   - Depois pode rodar sem janela mudando `HEADLESS=true` no `.env`.

## Comandos no Telegram

- `/sistemas` — lista os sistemas conhecidos
- `/abrir <nome>` — abre a sessão salva e manda um print
- `/status` — manda um print da página aberta agora
- `/login [nome]` — login novo: você manda o usuário e depois a senha, cada um
  numa mensagem; o bot digita no site e apaga a sua mensagem na hora
- `/cancelar` — cancela o login em andamento

## Login novo pedido pela IA (sem a senha passar pela IA)

1. A IA, no PC, pede o login na porta local:
   `curl -X POST http://127.0.0.1:8765/pedir-login -H "Content-Type: application/json" -d "{\"sistema\":\"exemplo\",\"motivo\":\"sessao expirou\"}"`
2. O bot avisa você no Telegram. Você manda `/login`, depois o usuário e a senha.
3. O bot digita direto no site (só em endereços da whitelist), apaga as suas
   mensagens e manda um print do resultado.
4. A IA acompanha só o estado, nunca a senha:
   `curl http://127.0.0.1:8765/estado`
   (`aguardando`, `em_andamento`, `concluido`, `cancelado`, `falhou`, `expirado`).

Para a IA controlar a página aberta pelo bot, o navegador escuta em
`http://127.0.0.1:9222` (Chrome DevTools Protocol). As duas portas só aceitam
conexões deste PC. Mude ou desligue (`0`) em `CONTROLE_PORTA` e `CDP_PORTA`.

Se o site tiver campos de login fora do padrão, informe os seletores em
`sistemas.json`: `"seletores": { "usuario": "#login", "senha": "#pass" }`.

## Tarefas livres para o Claude deste PC

Mande qualquer texto (sem `/`) e ele vira um pedido para o `claude.exe` deste
PC. O resultado volta no próprio Telegram. `/parar` cancela.

- O Claude trabalha só na pasta `TAREFAS_DIR` (padrão `~/bot-remoto-tarefas`):
  pode criar e editar arquivos lá dentro sem perguntar.
- Qualquer outra coisa (comando no PC, internet, arquivo fora da pasta) chega
  para você com os botões **Aprovar** / **Negar**. Cada botão vale para aquela
  ação, uma única vez; sem resposta em 5 minutos, é negado.
- Não usa as permissões amplas das suas configurações (`--setting-sources
  project`), e o Claude não pode mudar as próprias regras (`.claude/`).
- **Áudio:** mande uma mensagem de voz. O bot transcreve com o Gemini
  (`gemini-3.5-flash`, reserva `gemini-flash-lite-latest`), responde
  "Entendi: ..." e trata como texto. **O áudio vai para o Google.** A chave é
  `GEMINI_API_KEY` no `.env` ou, se faltar, a da skill watch
  (`~/.config/watch/.env`).
- Mensagens enviadas enquanto o bot estava desligado são ignoradas ao religar.
- Erros que derrubem o bot ficam em `bot-erros.log`.
- Para ligar: dois cliques em `LIGAR-BOT.bat` (não como administrador).
- Precisa do `claude.exe` logado uma vez (`claude auth login`) e da
  `CONTROLE_PORTA` ligada (o porteiro `aprovacao-mcp.js` usa essa porta).

## Teste automático (sem celular)

`npm test` roda o bot de verdade contra um Telegram falso local e a
`pagina-teste.js`: faz o login pelo fluxo da IA, confere as travas e salva os
prints em `prova-teste/`. Não usa o seu token nem o seu `browser-profile/`.

## O que esta ferramenta NÃO faz (de propósito)

- Não guarda senhas. A senha só passa pelo Telegram, vai direto para o campo
  do site e a mensagem é apagada; a IA nunca recebe a senha.
- Não digita credenciais em sites fora da whitelist.
- Não abre sites fora da whitelist `sistemas.json`.
- Não responde a ninguém além do seu `TELEGRAM_ALLOWED_USER_ID`.

## Cuidado honesto

Um print (`/status`) é enviado pelo Telegram, que **não é ponta-a-ponta**. Se a
tela tiver dado sensível (banco, e-mail), esse print passa pelos servidores do
Telegram. Use com consciência disso. O mesmo vale para a senha do `/login`:
ela é apagada do chat logo em seguida, mas passou pelo Telegram. Prefira contas
com verificação em duas etapas. E guarde bem o token: quem tiver o token
controla o bot.
