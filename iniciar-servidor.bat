@echo off
echo ========================================
echo    DESEO LIBRE - Servidor de Inicio
echo ========================================
echo.

echo Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado
    echo.
    echo Por favor instala Node.js desde: https://nodejs.org/
    echo Despues de instalar, reinicia esta ventana
    pause
    exit /b 1
)

echo Node.js encontrado!
echo.

echo Instalando dependencias...
npm install
if %errorlevel% neq 0 (
    echo ERROR: No se pudieron instalar las dependencias
    pause
    exit /b 1
)

echo.
echo Creando carpeta de uploads...
if not exist "public\uploads" mkdir "public\uploads"

echo.
echo ========================================
echo    Iniciando servidor...
echo ========================================
echo.
echo El servidor estara disponible en: http://localhost:3000
echo Presiona Ctrl+C para detener el servidor
echo.

node server.js
