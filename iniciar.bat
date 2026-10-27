@echo off
title Chamados Conciliador Contabil
cd /d "%~dp0"
echo Iniciando Chamados Conciliador Contabil...

:: Finaliza eventuais processos orfaos de electron travados
taskkill /f /fi "IMAGENAME eq electron.exe" >nul 2>&1

if not exist "node_modules\.bin\electron.cmd" (
  echo Instalando dependencias do projeto, aguarde...
  call npm install
)

if exist "node_modules\.bin\electron.cmd" (
  start "" "node_modules\.bin\electron.cmd" .
) else (
  start "" npm start
)
exit
