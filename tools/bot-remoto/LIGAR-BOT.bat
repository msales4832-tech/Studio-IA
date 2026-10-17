@echo off
rem Liga o bot-remoto nesta janela. Para desligar, feche a janela.
rem Abra com dois cliques (NAO use "Executar como administrador").
title bot-remoto (feche esta janela para desligar)
cd /d "%~dp0"
netstat -ano | findstr /r /c:"127.0.0.1:8765 .*LISTENING" >nul && (
  echo Ja existe um bot rodando ^(porta 8765 ocupada^). Feche o outro antes.
  pause
  exit /b 1
)
node --env-file=.env bot_remoto.js
pause
