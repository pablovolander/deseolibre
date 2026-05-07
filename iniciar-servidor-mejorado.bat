@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ════════════════════════════════════════════════════════
echo    DESEO LIBRE - INICIANDO SERVIDOR
echo ════════════════════════════════════════════════════════
echo.
echo 📍 Directorio: %CD%
echo.
echo 🔍 Verificando Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Node.js no está instalado o no está en el PATH
    echo.
    echo Por favor instala Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js encontrado
echo.
echo 🔍 Verificando puerto 3000...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  El puerto 3000 está en uso
    echo.
    echo Intentando detener procesos en el puerto 3000...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
        taskkill /F /PID %%a >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)
echo ✅ Puerto 3000 disponible
echo.
echo 🚀 Iniciando servidor...
echo.
start "Servidor Deseo Libre" cmd /k "node server.js"
timeout /t 4 /nobreak >nul
echo.
echo ✅ Servidor iniciado
echo.
echo 🌐 Abriendo navegador en: http://localhost:3000
echo.
start http://localhost:3000
echo.
echo ════════════════════════════════════════════════════════
echo    SERVIDOR ACTIVO
echo    URL: http://localhost:3000
echo ════════════════════════════════════════════════════════
echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause >nul

