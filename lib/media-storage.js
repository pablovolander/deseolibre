const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { isBlobUnavailableError, toBlobStorageUnavailableError } = require('./blob-errors');

const VERCEL_MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_PATH_PREFIX = 'uploads/';
const PROTECTED_PATH_PREFIX = 'uploads/verification/';
const BLOCKED_EXTENSIONS = new Set([
    '.html', '.htm', '.xhtml', '.shtml', '.svg', '.svgz', '.xml', '.xsl',
    '.js', '.mjs', '.css', '.php', '.exe', '.sh', '.bat', '.cmd'
]);

function hasBlockedExtension(pathname) {
    return BLOCKED_EXTENSIONS.has(path.extname(String(pathname || '')).toLowerCase());
}

/** Documentos de identidad, selfies y videos de verificación: solo el admin con enlace firmado. */
function isProtectedMediaPath(pathname) {
    return String(pathname || '').replace(/\\/g, '/').replace(/^\/+/, '').startsWith(PROTECTED_PATH_PREFIX);
}

function mediaSigningKey() {
    return String(process.env.JWT_SECRET || '');
}

function computeMediaSignature(pathname, expiresAt) {
    return crypto
        .createHmac('sha256', mediaSigningKey())
        .update(`${pathname}:${expiresAt}`)
        .digest('base64url');
}

function signMediaUrl(url, ttlSeconds = 2 * 60 * 60) {
    if (!url || typeof url !== 'string' || !url.startsWith('/api/media/')) {
        return url;
    }
    const pathname = decodeURIComponent(url.slice('/api/media/'.length).split('?')[0]);
    if (!isProtectedMediaPath(pathname) || !mediaSigningKey()) {
        return url;
    }
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    return `${url.split('?')[0]}?exp=${exp}&sig=${computeMediaSignature(pathname, exp)}`;
}

function verifyMediaSignature(pathname, exp, sig) {
    const expiresAt = Number(exp);
    if (!mediaSigningKey() || !Number.isFinite(expiresAt) || expiresAt < Date.now() / 1000 || !sig) {
        return false;
    }
    const expected = Buffer.from(computeMediaSignature(pathname, expiresAt));
    const given = Buffer.from(String(sig));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function isServerlessRuntime() {
    return (
        process.env.VERCEL === '1' ||
        Boolean(process.env.VERCEL_ENV) ||
        __dirname.includes('/var/task')
    );
}

function getBlobAccess() {
    const configured = String(process.env.BLOB_STORE_ACCESS || '').toLowerCase();
    if (configured === 'public' || configured === 'private') {
        return configured;
    }
    if (isServerlessRuntime()) {
        return 'private';
    }
    return 'public';
}

function getBlobToken() {
    return process.env.BLOB_READ_WRITE_TOKEN || null;
}

/** Carpeta privada en disco para archivos (servidor propio / VPS). Fuera de public/. */
function getMediaRoot() {
    const root = String(process.env.MEDIA_ROOT || '').trim();
    return root ? path.resolve(root) : null;
}

function usesLocalMediaRoot() {
    return Boolean(getMediaRoot()) && !getBlobToken() && !isServerlessRuntime();
}

function resolveMediaRootPath(pathname) {
    const root = getMediaRoot();
    if (!root || !isAllowedMediaPathname(pathname)) {
        return null;
    }
    const fullPath = path.resolve(root, pathname.replace(/\\/g, '/'));
    if (!fullPath.startsWith(root + path.sep)) {
        return null;
    }
    return fullPath;
}

function saveStreamToMediaRoot(pathname, stream, maxBytes) {
    const fullPath = resolveMediaRootPath(pathname);
    if (!fullPath) {
        return Promise.reject(new Error('Ruta de subida inválida'));
    }
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    const tmpPath = `${fullPath}.part`;

    return new Promise((resolve, reject) => {
        let written = 0;
        let failed = false;
        const out = fs.createWriteStream(tmpPath);
        const fail = (error) => {
            if (failed) return;
            failed = true;
            stream.unpipe(out);
            out.destroy();
            fs.promises.unlink(tmpPath).catch(() => {});
            reject(error);
        };
        stream.on('data', (chunk) => {
            written += chunk.length;
            if (maxBytes && written > maxBytes) {
                fail(new Error(`El archivo supera ${(maxBytes / (1024 * 1024)).toFixed(0)} MB`));
            }
        });
        stream.on('error', fail);
        out.on('error', fail);
        out.on('finish', () => {
            if (failed) return;
            if (!written) {
                fs.promises.unlink(tmpPath).catch(() => {});
                reject(new Error('Archivo vacío'));
                return;
            }
            fs.rename(tmpPath, fullPath, (error) => (error ? fail(error) : resolve({ pathname, size: written })));
        });
        stream.pipe(out);
    });
}

function sanitizeFilename(originalName) {
    const base = path.basename(originalName || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(base).toLowerCase() || '.jpg';
    const stem = path.basename(base, ext).slice(0, 80) || 'archivo';
    return `${stem}${ext}`;
}

function getUploadBuffer(file) {
    if (!file) {
        return null;
    }
    if (file.buffer && file.buffer.length) {
        return file.buffer;
    }
    if (file.path && fs.existsSync(file.path)) {
        return fs.readFileSync(file.path);
    }
    return null;
}

function toMediaProxyPath(pathname) {
    const encoded = pathname.split('/').map((part) => encodeURIComponent(part)).join('/');
    return `/api/media/${encoded}`;
}

function shouldUseBlobMediaProxy() {
    return isServerlessRuntime() || Boolean(getBlobToken());
}

function uploadsPathToBlobProxy(storedUrl) {
    if (!storedUrl || typeof storedUrl !== 'string' || !shouldUseBlobMediaProxy()) {
        return storedUrl;
    }
    const normalized = storedUrl.replace(/\\/g, '/');
    if (normalized.startsWith('/uploads/')) {
        return toMediaProxyPath(normalized.slice(1));
    }
    if (normalized.startsWith('uploads/')) {
        return toMediaProxyPath(normalized);
    }
    return storedUrl;
}

function normalizeStoredMediaUrl(storedUrl) {
    if (!storedUrl) {
        return '';
    }
    if (storedUrl.startsWith('/api/media/')) {
        return storedUrl;
    }
    if (storedUrl.includes('.private.blob.vercel-storage.com/') || storedUrl.includes('.public.blob.vercel-storage.com/')) {
        try {
            const url = new URL(storedUrl);
            const pathname = decodeURIComponent(url.pathname.replace(/^\//, ''));
            if (pathname.startsWith(ALLOWED_PATH_PREFIX)) {
                return toMediaProxyPath(pathname);
            }
        } catch {
            return storedUrl;
        }
    }
    return uploadsPathToBlobProxy(storedUrl);
}

async function readableStreamToBuffer(stream) {
    const nodeStream = Readable.fromWeb(stream);
    const chunks = [];
    for await (const chunk of nodeStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

async function persistUploadedFile(file, isVercel, localUploadDir, options = {}) {
    if (!file) {
        return null;
    }

    const safeName = sanitizeFilename(file.originalname || file.filename);
    if (hasBlockedExtension(safeName)) {
        throw new Error('Tipo de archivo no permitido');
    }
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${safeName}`;
    const folder = String(options.folder || '').replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '');
    const blobPathname = folder ? `uploads/${folder}/${uniqueName}` : `uploads/${uniqueName}`;
    const buffer = getUploadBuffer(file);

    if (!buffer || !buffer.length) {
        throw new Error('Archivo vacío o no legible en el servidor');
    }

    const serverless = isVercel || isServerlessRuntime();

    if (!serverless && usesLocalMediaRoot()) {
        const fullPath = resolveMediaRootPath(blobPathname);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, buffer);
        return toMediaProxyPath(blobPathname);
    }

    if (serverless && buffer.length > VERCEL_MAX_UPLOAD_BYTES) {
        throw new Error(
            `El archivo supera ${(VERCEL_MAX_UPLOAD_BYTES / (1024 * 1024)).toFixed(1)} MB (límite de Vercel). Usa un archivo más pequeño o comprímelo.`
        );
    }

    if (!serverless) {
        const uploadDir = localUploadDir || path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const dest = path.join(uploadDir, uniqueName);
        fs.writeFileSync(dest, buffer);
        return `/uploads/${uniqueName}`;
    }

    if (!getBlobToken()) {
        throw new Error(
            'Almacenamiento en la nube no configurado. En Vercel: Storage → Blob → conectar al proyecto (BLOB_READ_WRITE_TOKEN).'
        );
    }

    const access = getBlobAccess();
    const { put } = require('@vercel/blob');

    try {
        const blob = await put(blobPathname, buffer, {
            access,
            contentType: file.mimetype || 'application/octet-stream',
            token: getBlobToken(),
            addRandomSuffix: false,
            allowOverwrite: true
        });

        if (access === 'private') {
            return toMediaProxyPath(blob.pathname || blobPathname);
        }

        if (!blob || !blob.url) {
            throw new Error('Vercel Blob no devolvió URL del archivo');
        }

        return blob.url;
    } catch (error) {
        const message = String(error.message || '');
        if (isBlobUnavailableError(error)) {
            throw toBlobStorageUnavailableError(error);
        }
        if (message.toLowerCase().includes('private') || message.toLowerCase().includes('access')) {
            throw new Error(
                'Tu almacén Blob en Vercel es privado. El servidor ya está configurado para eso; espera el nuevo deploy o define BLOB_STORE_ACCESS=private en Vercel.'
            );
        }
        throw error;
    }
}

function isAllowedMediaPathname(pathname) {
    if (!pathname || typeof pathname !== 'string') {
        return false;
    }
    const normalized = pathname.replace(/\\/g, '/');
    if (normalized.includes('..') || hasBlockedExtension(normalized)) {
        return false;
    }
    return normalized.startsWith(ALLOWED_PATH_PREFIX);
}

async function streamPrivateMedia(pathname, res, headOnly = false) {
    if (usesLocalMediaRoot()) {
        const fullPath = resolveMediaRootPath(decodeURIComponent(pathname).replace(/\\/g, '/'));
        if (!fullPath) {
            res.status(400).json({ error: 'Ruta de archivo no permitida' });
            return;
        }
        if (!fs.existsSync(fullPath)) {
            res.status(404).json({ error: 'Archivo no encontrado' });
            return;
        }
        res.setHeader(
            'Cache-Control',
            isProtectedMediaPath(pathname) ? 'private, no-store' : 'public, max-age=86400, immutable'
        );
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
        await new Promise((resolve) => {
            res.sendFile(fullPath, (error) => {
                if (error && !res.headersSent) {
                    res.status(error.statusCode || 404).json({ error: 'Archivo no encontrado' });
                }
                resolve();
            });
        });
        return;
    }

    if (!getBlobToken()) {
        res.status(503).json({ error: 'Almacenamiento no configurado' });
        return;
    }

    const decodedPath = decodeURIComponent(pathname).replace(/\\/g, '/');
    if (!isAllowedMediaPathname(decodedPath)) {
        res.status(400).json({ error: 'Ruta de archivo no permitida' });
        return;
    }

    const { get } = require('@vercel/blob');
    const token = getBlobToken();
    const accessModes = getBlobAccess() === 'private' ? ['private', 'public'] : ['public', 'private'];
    let result = null;

    for (const access of accessModes) {
        try {
            const attempt = await get(decodedPath, { access, token });
            if (attempt && attempt.statusCode === 200 && attempt.stream) {
                result = attempt;
                break;
            }
        } catch {
            // Probar el siguiente modo de acceso del Blob
        }
    }

    if (!result) {
        res.status(404).json({ error: 'Archivo no encontrado' });
        return;
    }

    if (result.statusCode === 304) {
        res.status(304).end();
        return;
    }

    if (result.statusCode !== 200 || !result.stream) {
        res.status(404).json({ error: 'Archivo no encontrado' });
        return;
    }

    res.setHeader('Content-Type', result.blob.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (result.blob.etag) {
        res.setHeader('ETag', result.blob.etag);
    }

    if (headOnly) {
        res.status(200).end();
        return;
    }

    Readable.fromWeb(result.stream).pipe(res);
}

function resolveMediaUrl(storedUrl, requestOrigin) {
    const normalized = normalizeStoredMediaUrl(storedUrl);
    if (!normalized) {
        return '';
    }
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
        return normalized;
    }
    const origin = requestOrigin || '';
    return `${origin}${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

module.exports = {
    VERCEL_MAX_UPLOAD_BYTES,
    isProtectedMediaPath,
    signMediaUrl,
    verifyMediaSignature,
    hasBlockedExtension,
    isServerlessRuntime,
    getBlobAccess,
    getBlobToken,
    getMediaRoot,
    usesLocalMediaRoot,
    resolveMediaRootPath,
    saveStreamToMediaRoot,
    persistUploadedFile,
    resolveMediaUrl,
    normalizeStoredMediaUrl,
    uploadsPathToBlobProxy,
    streamPrivateMedia,
    readableStreamToBuffer,
    toMediaProxyPath
};
