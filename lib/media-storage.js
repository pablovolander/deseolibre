const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { isBlobUnavailableError, toBlobStorageUnavailableError } = require('./blob-errors');

const VERCEL_MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const ALLOWED_PATH_PREFIX = 'uploads/';

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

async function persistUploadedFile(file, isVercel, localUploadDir) {
    if (!file) {
        return null;
    }

    const safeName = sanitizeFilename(file.originalname || file.filename);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${safeName}`;
    const blobPathname = `uploads/${uniqueName}`;
    const buffer = getUploadBuffer(file);

    if (!buffer || !buffer.length) {
        throw new Error('Archivo vacío o no legible en el servidor');
    }

    const serverless = isVercel || isServerlessRuntime();

    if (serverless && buffer.length > VERCEL_MAX_UPLOAD_BYTES) {
        throw new Error('El archivo supera 4.5 MB (límite de Vercel). Usa una imagen más pequeña.');
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
    if (normalized.includes('..')) {
        return false;
    }
    return normalized.startsWith(ALLOWED_PATH_PREFIX);
}

async function streamPrivateMedia(pathname, res, headOnly = false) {
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
    isServerlessRuntime,
    getBlobAccess,
    getBlobToken,
    persistUploadedFile,
    resolveMediaUrl,
    normalizeStoredMediaUrl,
    uploadsPathToBlobProxy,
    streamPrivateMedia,
    readableStreamToBuffer,
    toMediaProxyPath
};
