@echo off
title Organizador de Chamados - Conciliador Contabil
cd /d "%~dp0"
echo Iniciando o Organizador de Chamados...

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
