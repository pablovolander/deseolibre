# Arranca Deseo Libre en local con variables desde .env.local
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

if (-not (Test-Path ".env.local")) {
    Write-Host ""
    Write-Host "No existe .env.local — creando desde .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
    Write-Host "Edita .env.local y pon tu RESEND_API_KEY, luego vuelve a ejecutar este script." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "Instalando dependencias si hace falta..." -ForegroundColor Cyan
npm install --silent

Write-Host ""
Write-Host "Servidor en http://localhost:3000" -ForegroundColor Green
Write-Host "Sin RESEND_API_KEY válida, forgot-password imprime devResetUrl en consola." -ForegroundColor DarkGray
Write-Host ""

npm start
