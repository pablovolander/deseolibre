# Configurar Turso — paso a paso

Guía para activar Turso en **Deseo Libre** (gratis).

---

## Paso 1 — Crear cuenta y base de datos

1. Abre **https://turso.tech/app** e inicia sesión (GitHub sirve).
2. **Create database**
3. Nombre: `deseo-libre`
4. Región: la más cercana (ej. `aws-us-east-1` o `gcp-europe-west3`)

---

## Paso 2 — Obtener URL y token

En el panel de la base `deseo-libre`:

1. **Connect** → copia **Database URL**  
   Formato: `libsql://deseo-libre-XXXX.turso.io`

2. **Create token** (o Tokens → Create)  
   Copia el token (solo se muestra una vez).

---

## Paso 3 — Configurar local (`.env.local`)

En la carpeta del proyecto, edita o crea `.env.local`:

```env
TURSO_DATABASE_URL=libsql://deseo-libre-TUORG.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
```

(No subas este archivo a git.)

---

## Paso 4 — Copiar tu base local a Turso

En PowerShell:

```powershell
cd "C:\Users\pablo\OneDrive\Desktop\Cursor 3 - server"
npm run db:test-turso
npm run db:push-turso
```

- `db:test-turso` — comprueba conexión  
- `db:push-turso` — sube `deseo_libre.db` (usuarios, posts, etc.)

---

## Paso 5 — Probar en local con Turso

```powershell
npm start
```

Abre http://localhost:3000/api/health — debe mostrar:

```json
"turso": true,
"databaseMode": "turso"
```

---

## Paso 6 — Variables en Vercel (producción)

1. https://vercel.com → proyecto **deseolibre**
2. **Settings → Environment Variables**
3. Añade en **Production** (y Preview si quieres):

| Name | Value |
|------|--------|
| `TURSO_DATABASE_URL` | la misma URL de Turso |
| `TURSO_AUTH_TOKEN` | el mismo token |

4. **Deployments → Redeploy** (último deploy)

---

## Paso 7 — Comprobar producción

```
https://deseolibre.vercel.app/api/health
```

Esperado:

```json
{
  "ok": true,
  "turso": true,
  "blobPersistence": false,
  "databaseMode": "turso"
}
```

Prueba **registrarte** en el sitio.

---

## Paso 8 — Backup automático (opcional)

En GitHub → repo **deseolibre** → **Settings → Secrets → Actions**:

| Secret | Valor |
|--------|--------|
| `TURSO_API_TOKEN` | en Turso: Settings → API tokens |
| `TURSO_DB_NAME` | `deseo-libre` |

El workflow `.github/workflows/backup-turso.yml` hará backup semanal.

---

## Problemas frecuentes

| Síntoma | Solución |
|---------|----------|
| `turso: false` en health | Faltan variables en Vercel o no redeployaste |
| Error al registrar | Revisa logs Vercel; con Turso no debería depender de Blob para BD |
| Fotos no suben | Blob puede seguir suspendido; Turso no arregla media |
| Token inválido | Crea token nuevo en Turso y actualiza Vercel + `.env.local` |

---

## ¿CLI de Turso? (opcional)

Instalación manual: https://docs.turso.tech/cli/installation

No es obligatoria; los scripts `npm run db:*` bastan.
