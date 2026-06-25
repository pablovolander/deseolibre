const fs = require('fs');
const { getBlobAccess, getBlobToken, readableStreamToBuffer } = require('./media-storage');
const {
    isBlobUnavailableError,
    markBlobSuspended,
    isBlobStorageSuspended,
    toBlobStorageUnavailableError
} = require('./blob-errors');

const BLOB_DB_NAME = 'deseo-libre-database.db';
const BLOB_PROBE_TTL_MS = 60 * 1000;
let blobProbeCache = { checkedAt: 0, suspended: false };

function noteBlobAccessFailure(details) {
    if (!details) {
        return false;
    }
    const statusCode = Number(details.statusCode);
    const message = String(details.message || details.error?.message || '').toLowerCase();
    const suspended =
        statusCode === 403 ||
        statusCode === 503 ||
        message.includes('suspended') ||
        message.includes('forbidden');

    if (suspended || isBlobUnavailableError(details)) {
        markBlobSuspended(details);
        return true;
    }
    return false;
}

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
                noteBlobAccessFailure(result);
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
            const httpError = new Error(`HTTP ${response.status}`);
            httpError.statusCode = response.status;
            throw httpError;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(dbPath, buffer);
        console.log('Base de datos restaurada desde Vercel Blob');
    } catch (error) {
        if (isBlobUnavailableError(error) || noteBlobAccessFailure(error)) {
            console.warn('Vercel Blob suspendido; no se pudo restaurar la base de datos:', error.message);
            return;
        }
        const message = error.message || '';
        if (!message.includes('does not exist') && error.statusCode !== 404) {
            console.warn('No se pudo restaurar la base de datos desde Blob:', message);
        }
    }
}

async function probeBlobStorageAvailability(isVercel) {
    if (!isVercel || !getBlobToken()) {
        return { configured: false, suspended: false };
    }

    if (isBlobStorageSuspended()) {
        return { configured: true, suspended: true };
    }

    try {
        const { head } = require('@vercel/blob');
        await head(BLOB_DB_NAME, { token: getBlobToken() });
        return { configured: true, suspended: false };
    } catch (error) {
        if (isBlobUnavailableError(error) || noteBlobAccessFailure(error)) {
            return { configured: true, suspended: true };
        }

        const message = String(error.message || '').toLowerCase();
        if (error.statusCode === 404 || message.includes('does not exist')) {
            return { configured: true, suspended: false };
        }

        return { configured: true, suspended: isBlobStorageSuspended() };
    }
}

async function resolveBlobSuspendedStatus(isVercel) {
    if (isBlobStorageSuspended()) {
        return true;
    }

    if (!isVercel || !getBlobToken()) {
        return false;
    }

    const now = Date.now();
    if (now - blobProbeCache.checkedAt < BLOB_PROBE_TTL_MS) {
        return blobProbeCache.suspended;
    }

    const probe = await probeBlobStorageAvailability(isVercel);
    blobProbeCache = { checkedAt: now, suspended: probe.suspended };
    return probe.suspended;
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
    persistDatabase,
    probeBlobStorageAvailability,
    resolveBlobSuspendedStatus
};
