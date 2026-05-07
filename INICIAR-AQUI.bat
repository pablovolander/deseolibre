@echo off
cd /d "%~dp0"
echo ========================================
echo    DESEO LIBRE - INICIANDO SERVIDOR
echo ========================================
echo.
echo Directorio actual: %CD%
echo.
echo Iniciando servidor en puerto 3000...
echo.
node server.js
pause

