@echo off
chcp 65001 >nul
cd /d "%~dp0"
cls

echo ════════════════════════════════════════════════════════
echo    DESEO LIBRE - TEST COMPLETO
echo ════════════════════════════════════════════════════════
echo.

echo [1/4] Verificando archivos...
if exist "server.js" (
    echo ✓ server.js encontrado
) else (
    echo ✗ ERROR: server.js NO encontrado
    pause
    exit
)

if exist "package.json" (
    echo ✓ package.json encontrado
) else (
    echo ✗ ERROR: package.json NO encontrado
    pause
    exit
)

if exist "deseo_libre.db" (
    echo ✓ Base de datos encontrada
) else (
    echo ✗ WARNING: Base de datos NO encontrada (se creará)
)

echo.
echo [2/4] Verificando Node.js...
node --version
if %errorlevel% neq 0 (
    echo ✗ ERROR: Node.js NO instalado
    pause
    exit
)

echo.
echo [3/4] Iniciando servidor...
echo.
echo ════════════════════════════════════════════════════════
echo    SERVIDOR ACTIVO
echo    URL: http://localhost:3000
echo    
echo    Para detener: Cierra esta ventana o presiona CTRL+C
echo ════════════════════════════════════════════════════════
echo.

node server.js

pause

