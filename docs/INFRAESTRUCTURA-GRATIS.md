# Infraestructura gratuita — Deseo Libre

Guía para poner en producción **sin coste mensual** (Turso + UptimeRobot + Sentry free).

## 1. Turso (base de datos)

La app usa SQLite. Con Turso la BD vive en la nube y **deja de copiarse en Vercel Blob** (evita bloqueos al registrar usuarios).

### Crear la base

1. Instala la CLI: https://docs.turso.tech/cli
2. `turso auth login`
3. `turso db create deseo-libre`
4. `turso db show deseo-libre --url` → copia la URL
5. `turso db tokens create deseo-libre` → copia el token

### Migrar datos locales (opcional)

Si ya tienes `deseo_libre.db` en tu PC:

```powershell
cd "C:\Users\pablo\OneDrive\Desktop\Cursor 3 - server"
sqlite3 deseo_libre.db .dump > scripts\turso-import.sql
turso db shell deseo-libre < scripts\turso-import.sql
```

### Variables en Vercel

En **Project → Settings → Environment Variables** (Production):

| Variable | Valor |
|----------|--------|
| `TURSO_DATABASE_URL` | `libsql://...` |
| `TURSO_AUTH_TOKEN` | token de Turso |

Mantén `BLOB_READ_WRITE_TOKEN` **solo para fotos/vídeos**.

Redeploy. Comprueba:

```
https://deseolibre.vercel.app/api/health
```

Debe mostrar `"turso": true` y `"blobPersistence": false`.

---

## 2. UptimeRobot (gratis)

1. Cuenta en https://uptimerobot.com
2. **Add monitor** → HTTP(s)
3. URL: `https://deseolibre.vercel.app/api/health`
4. Intervalo: 5 minutos
5. Alerta por email si cae o responde 503

Opcional: alerta si el JSON contiene `"blobSuspended": true` (monitor avanzado o revisión manual).

---

## 3. Sentry (gratis)

1. Cuenta en https://sentry.io
2. Proyecto Node.js
3. Copia el **DSN**
4. En Vercel: `SENTRY_DSN=https://...`

Los errores 500 en registro/login aparecerán en el panel de Sentry.

---

## 4. Backup automático (GitHub Actions)

Workflow: `.github/workflows/backup-turso.yml`

Secrets en GitHub (**Settings → Secrets → Actions**):

| Secret | Descripción |
|--------|-------------|
| `TURSO_API_TOKEN` | Token de la CLI (`turso auth token`) |
| `TURSO_DB_NAME` | Ej: `deseo-libre` |

Se genera un artefacto `.sql` cada semana (retención 14 días).

---

## Coste estimado

| Servicio | Coste |
|----------|--------|
| Vercel Hobby | €0 |
| Turso Free | €0 |
| UptimeRobot Free | €0 |
| Sentry Free | €0 |
| GitHub Actions backup | €0 |

**Total: €0/mes** (hasta superar límites free).

---

## Local

En `.env.local`:

```
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=...
```

Sin Turso, sigue usando `./deseo_libre.db` en disco.
