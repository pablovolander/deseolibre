const fs = require('fs');
const path = require('path');

async function persistUploadedFile(file, isVercel) {
    if (!file) {
        return null;
    }

    const filename = file.filename || path.basename(file.path || '');
    const localPath = file.path;

    if (!isVercel || !process.env.BLOB_READ_WRITE_TOKEN) {
        return `/uploads/${filename}`;
    }

    if (!localPath || !fs.existsSync(localPath)) {
        throw new Error('Archivo subido no encontrado en el servidor');
    }

    const { put } = require('@vercel/blob');
    const data = fs.readFileSync(localPath);
    const blobPath = `uploads/${filename}`;
    const blob = await put(blobPath, data, {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true
    });

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
    persistUploadedFile,
    resolveMediaUrl
};
