# Variables de Entorno - Deseo Libre

## Configuración Requerida

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# ============================================
# DESEO LIBRE - VARIABLES DE ENTORNO
# ============================================

# Entorno (development | production)
NODE_ENV=production

# Puerto del servidor (Railway/Render lo asignan automáticamente)
PORT=3000

# JWT Secret Key (OBLIGATORIO EN PRODUCCIÓN)
# Genera una clave segura con: openssl rand -base64 32
JWT_SECRET=tu_clave_secreta_muy_larga_y_compleja_aqui

# Orígenes permitidos para CORS (separados por comas)
# Ejemplo: https://tudominio.com,https://www.tudominio.com
ALLOWED_ORIGINS=https://tudominio.com
```

## Variables Opcionales

```env
# Ruta de la base de datos (por defecto: ./deseo_libre.db)
DB_PATH=./deseo_libre.db

# API Key para generación de imágenes AI (si se implementa)
AI_PROVIDER_API_KEY=tu_api_key_aqui
```

## Generar JWT_SECRET

En Linux/Mac:
```bash
openssl rand -base64 32
```

En Windows (PowerShell):
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

## Importante

- **NUNCA** subas el archivo `.env` a Git
- El archivo `.env` debe estar en `.gitignore`
- En producción, configura estas variables en tu plataforma de hosting (Railway, Render, etc.)

