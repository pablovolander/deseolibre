const BLOB_UNAVAILABLE_MESSAGE =
    'El almacenamiento del sitio está temporalmente suspendido (límite del plan gratuito de Vercel). ' +
    'No se pueden registrar cuentas ni guardar cambios hasta que se reactive el almacenamiento o se actualice el plan. ' +
    'Vuelve a intentarlo más tarde.';

let blobStorageSuspended = false;

class BlobStorageUnavailableError extends Error {
    constructor(originalError) {
        super(BLOB_UNAVAILABLE_MESSAGE);
        this.name = 'BlobStorageUnavailableError';
        this.code = 'BLOB_UNAVAILABLE';
        this.originalError = originalError;
    }
}

let BlobStoreSuspendedErrorClass = null;
try {
    BlobStoreSuspendedErrorClass = require('@vercel/blob').BlobStoreSuspendedError;
} catch (_) {
    BlobStoreSuspendedErrorClass = null;
}

function isBlobUnavailableError(error) {
    if (!error) {
        return false;
    }
    if (error instanceof BlobStorageUnavailableError) {
        return true;
    }
    if (BlobStoreSuspendedErrorClass && error instanceof BlobStoreSuspendedErrorClass) {
        return true;
    }

    const name = String(error.name || '');
    const message = String(error.message || '').toLowerCase();
    const code = String(error.code || '');

    return (
        name === 'BlobStoreSuspendedError' ||
        code === 'BLOB_UNAVAILABLE' ||
        code === 'BlobStoreSuspended' ||
        code === 'store_suspended' ||
        message.includes('has been suspended') ||
        message.includes('blob store suspended') ||
        message.includes('blobstoresuspended') ||
        message.includes('store is suspended') ||
        (Number(error.statusCode) === 403 && message.includes('blob')) ||
        Number(error.statusCode) === 403
    );
}

function markBlobSuspended(error) {
    if (isBlobUnavailableError(error)) {
        blobStorageSuspended = true;
    }
}

function isBlobStorageSuspended() {
    return blobStorageSuspended;
}

function toBlobStorageUnavailableError(error) {
    markBlobSuspended(error);
    if (error instanceof BlobStorageUnavailableError) {
        return error;
    }
    return new BlobStorageUnavailableError(error);
}

function getBlobUnavailablePayload() {
    return {
        error: BLOB_UNAVAILABLE_MESSAGE,
        code: 'BLOB_UNAVAILABLE'
    };
}

function sendApiError(res, error, options = {}) {
    const {
        development = false,
        logLabel = null,
        status = 500,
        fallback = 'Error interno del servidor'
    } = options;

    if (isBlobUnavailableError(error)) {
        return res.status(503).json(getBlobUnavailablePayload());
    }

    if (logLabel) {
        console.error(logLabel, error);
    }

    const message =
        development && error && error.message ? error.message : fallback;

    return res.status(status).json({ error: message });
}

module.exports = {
    BLOB_UNAVAILABLE_MESSAGE,
    BlobStorageUnavailableError,
    isBlobUnavailableError,
    markBlobSuspended,
    isBlobStorageSuspended,
    toBlobStorageUnavailableError,
    getBlobUnavailablePayload,
    sendApiError
};
