const fs = require('fs');

const BLOB_DB_NAME = 'deseo-libre-database.db';

async function restoreDatabaseIfNeeded(dbPath, isVercel) {
    if (!isVercel || !process.env.BLOB_READ_WRITE_TOKEN) {
        return;
    }

    try {
        const { head } = require('@vercel/blob');
        const meta = await head(BLOB_DB_NAME);
        const response = await fetch(meta.url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(dbPath, buffer);
        console.log('Base de datos restaurada desde Vercel Blob');
    } catch (error) {
        if (!error.message?.includes('does not exist') && error.statusCode !== 404) {
            console.warn('No se pudo restaurar la base de datos desde Blob:', error.message);
        }
    }
}

async function persistDatabaseNow(dbPath, isVercel) {
    if (!isVercel || !process.env.BLOB_READ_WRITE_TOKEN) {
        return;
    }

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
}

function persistDatabase(dbPath, isVercel) {
    persistDatabaseNow(dbPath, isVercel).catch((error) => {
        console.error('Error al guardar la base de datos en Blob:', error.message);
    });
}

module.exports = {
    restoreDatabaseIfNeeded,
    persistDatabaseNow,
    persistDatabase
};
