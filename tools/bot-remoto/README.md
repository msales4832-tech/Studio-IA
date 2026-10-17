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

## O que esta ferramenta NÃO faz (de propósito)

- Não recebe, guarda nem digita senhas.
- Não abre sites fora da whitelist `sistemas.json`.
- Não responde a ninguém além do seu `TELEGRAM_ALLOWED_USER_ID`.

## Cuidado honesto

Um print (`/status`) é enviado pelo Telegram, que **não é ponta-a-ponta**. Se a
tela tiver dado sensível (banco, e-mail), esse print passa pelos servidores do
Telegram. Use com consciência disso. E guarde bem o token: quem tiver o token
controla o bot.
