const fs = require('fs');
const path = require('path');

const VERCEL_MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

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

async function persistUploadedFile(file, isVercel, localUploadDir) {
    if (!file) {
        return null;
    }

    const safeName = sanitizeFilename(file.originalname || file.filename);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${safeName}`;
    const buffer = getUploadBuffer(file);

    if (!buffer || !buffer.length) {
        throw new Error('Archivo vacío o no legible en el servidor');
    }

    if (isVercel && buffer.length > VERCEL_MAX_UPLOAD_BYTES) {
        throw new Error('El archivo supera 4.5 MB (límite de Vercel). Usa una imagen más pequeña.');
    }

    if (!isVercel || !process.env.BLOB_READ_WRITE_TOKEN) {
        const uploadDir = localUploadDir || path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const dest = path.join(uploadDir, uniqueName);
        fs.writeFileSync(dest, buffer);
        return `/uploads/${uniqueName}`;
    }

    const { put } = require('@vercel/blob');
    const blob = await put(`uploads/${uniqueName}`, buffer, {
        access: 'public',
        contentType: file.mimetype || 'application/octet-stream',
        token: process.env.BLOB_READ_WRITE_TOKEN
    });

    if (!blob || !blob.url) {
        throw new Error('Vercel Blob no devolvió URL del archivo');
    }

    return blob.url;
}

function resolveMediaUrl(storedUrl, requestOrigin) {
    if (!storedUrl) {
        return '';
    }
    if (storedUrl.startsWith('http://') || storedUrl.startsWith('https://')) {
        return storedUrl;
    }
    const origin = requestOrigin || '';
    return `${origin}${storedUrl.startsWith('/') ? storedUrl : `/${storedUrl}`}`;
}

module.exports = {
    VERCEL_MAX_UPLOAD_BYTES,
    persistUploadedFile,
    resolveMediaUrl
};
