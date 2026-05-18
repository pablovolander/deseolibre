const fs = require('fs');

const BLOB_DB_NAME = 'deseo-libre-database.db';

async function restoreDatabaseIfNeeded(dbPath, isVercel) {
    if (!isVercel || !process.env.BLOB_READ_WRITE_TOKEN) {
        return;
    }

    try {
        const { list } = require('@vercel/blob');
        const { blobs } = await list({ prefix: BLOB_DB_NAME, limit: 1 });
        if (!blobs.length) {
            return;
        }

        const response = await fetch(blobs[0].url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(dbPath, buffer);
        console.log('Base de datos restaurada desde Vercel Blob');
    } catch (error) {
        console.warn('No se pudo restaurar la base de datos desde Blob:', error.message);
    }
}

let persistTimer = null;

function scheduleDatabasePersist(dbPath, isVercel) {
    if (!isVercel || !process.env.BLOB_READ_WRITE_TOKEN) {
        return;
    }

    clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
        try {
            if (!fs.existsSync(dbPath)) {
                return;
            }

            const { put } = require('@vercel/blob');
            const data = fs.readFileSync(dbPath);
            await put(BLOB_DB_NAME, data, {
                access: 'private',
                addRandomSuffix: false,
                allowOverwrite: true
            });
        } catch (error) {
            console.error('Error al guardar la base de datos en Blob:', error.message);
        }
    }, 400);
}

module.exports = {
    restoreDatabaseIfNeeded,
    scheduleDatabasePersist
};
