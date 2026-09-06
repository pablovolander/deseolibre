# Variables de Entorno - Deseo Libre

## Configuración requerida

Crea `.env.local` (o configura las mismas claves en Vercel → Project → Settings → Environment Variables):

```env
# Entorno (development | production)
NODE_ENV=production

# Puerto (local). En Vercel no hace falta.
PORT=3000

# JWT Secret (OBLIGATORIO en producción / Vercel)
# openssl rand -base64 32
JWT_SECRET=tu_clave_secreta_muy_larga_y_compleja_aqui

# Orígenes CORS (coma-separados). Sin esto solo se confían *.vercel.app y localhost.
ALLOWED_ORIGINS=https://deseolibre.vercel.app
```

## Base de datos y media (producción)

```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

## Email / recuperación de contraseña (Resend)

Sin estas variables, “Olvidé mi contraseña” **no envía correo** (en desarrollo sí muestra `devResetUrl`).

```env
# API key real de https://resend.com/api-keys (empieza con re_ y es larga)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx

# Remitente. Con onboarding@resend.dev solo puedes enviar a tu email de la cuenta Resend.
# Para producción: verifica un dominio en Resend y usa algo como:
# MAIL_FROM=Deseo Libre <noreply@tudominio.com>
MAIL_FROM=Deseo Libre <onboarding@resend.dev>

# URL pública del sitio (enlaces del email de reset)
APP_BASE_URL=https://deseolibre.vercel.app
```

### Checklist rápido en Vercel

1. Crea cuenta en [resend.com](https://resend.com) → API Keys → Create.
2. En Vercel, añade `RESEND_API_KEY`, `MAIL_FROM`, `APP_BASE_URL` (Production + Preview).
3. Redeploy el proyecto (o espera al próximo deploy).
4. Comprueba `https://deseolibre.vercel.app/api/health` → `email.configured` debe ser `true`.
5. Prueba “Olvidé mi contraseña” con el email de tu cuenta Resend (si usas `onboarding@resend.dev`).

## Variables opcionales

```env
DB_PATH=./deseo_libre.db
AI_PROVIDER_API_KEY=
```

## Importante

- **Nunca** subas `.env` / `.env.local` a Git
- En producción configura las variables en el panel de Vercel
- `/api/health` expone `email.configured` (boolean) y `email.from` (remitente), sin filtrar la API key
