const fs = require('fs');
const { getBlobAccess, getBlobToken, readableStreamToBuffer } = require('./media-storage');
const {
    isBlobUnavailableError,
    markBlobSuspended,
    toBlobStorageUnavailableError
} = require('./blob-errors');

const BLOB_DB_NAME = 'deseo-libre-database.db';

async function restoreDatabaseIfNeeded(dbPath, isVercel) {
    if (!isVercel || !getBlobToken()) {
        return;
    }

    const access = getBlobAccess();

    try {
        if (access === 'private') {
            const { get } = require('@vercel/blob');
            const result = await get(BLOB_DB_NAME, {
                access: 'private',
                token: getBlobToken()
            });

            if (!result || result.statusCode !== 200 || !result.stream) {
                return;
            }

            const buffer = await readableStreamToBuffer(result.stream);
            fs.writeFileSync(dbPath, buffer);
            console.log('Base de datos restaurada desde Vercel Blob (privado)');
            return;
        }

        const { head } = require('@vercel/blob');
        const meta = await head(BLOB_DB_NAME, { token: getBlobToken() });
        const response = await fetch(meta.url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(dbPath, buffer);
        console.log('Base de datos restaurada desde Vercel Blob');
    } catch (error) {
        if (isBlobUnavailableError(error)) {
            markBlobSuspended(error);
            console.warn('Vercel Blob suspendido; no se pudo restaurar la base de datos:', error.message);
            return;
        }
        const message = error.message || '';
        if (!message.includes('does not exist') && error.statusCode !== 404) {
            console.warn('No se pudo restaurar la base de datos desde Blob:', message);
        }
    }
}

async function persistDatabaseNow(dbPath, isVercel) {
    if (!isVercel || !getBlobToken()) {
        return;
    }

    if (!fs.existsSync(dbPath)) {
        return;
    }

    const { put } = require('@vercel/blob');
    const data = fs.readFileSync(dbPath);
    try {
        await put(BLOB_DB_NAME, data, {
            access: getBlobAccess(),
            token: getBlobToken(),
            addRandomSuffix: false,
            allowOverwrite: true,
            contentType: 'application/x-sqlite3'
        });
    } catch (error) {
        if (isBlobUnavailableError(error)) {
            throw toBlobStorageUnavailableError(error);
        }
        throw error;
    }
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
