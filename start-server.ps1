Set-Location "C:\Users\pablo\OneDrive\Desktop\Cursor 3"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INICIANDO SERVIDOR DESEO LIBRE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en el directorio correcto
$currentDir = Get-Location
Write-Host "Directorio actual: $currentDir" -ForegroundColor Yellow
Write-Host ""

# Verificar que server.js existe
if (Test-Path ".\server.js") {
    Write-Host "OK - server.js encontrado" -ForegroundColor Green
} else {
    Write-Host "ERROR - server.js NO encontrado" -ForegroundColor Red
    exit 1
}

# Verificar que node_modules existe
if (Test-Path ".\node_modules") {
    Write-Host "OK - node_modules encontrado" -ForegroundColor Green
} else {
    Write-Host "ERROR - node_modules NO encontrado" -ForegroundColor Red
    Write-Host "Ejecuta: npm install" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Iniciando servidor..." -ForegroundColor Cyan
Write-Host ""

# Iniciar el servidor
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$currentDir'; node server.js"

# Esperar un poco
Start-Sleep -Seconds 3

# Verificar que el servidor está corriendo
$serverRunning = netstat -ano | Select-String ":3000"
if ($serverRunning) {
    Write-Host "OK - Servidor corriendo en puerto 3000" -ForegroundColor Green
    Write-Host ""
    Write-Host "Abre tu navegador y ve a:" -ForegroundColor Yellow
    Write-Host "  http://localhost:3000" -ForegroundColor Cyan
    Write-Host ""
    
    # Abrir el navegador
    Start-Process "http://localhost:3000"
} else {
    Write-Host "ERROR - El servidor no esta corriendo en el puerto 3000" -ForegroundColor Red
    Write-Host "Revisa la ventana del servidor para ver errores" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Presiona cualquier tecla para salir..."
