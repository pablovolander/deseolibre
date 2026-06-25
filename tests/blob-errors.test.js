const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    isBlobUnavailableError,
    BlobStorageUnavailableError,
    toBlobStorageUnavailableError,
    getBlobUnavailablePayload
} = require('../lib/blob-errors');

test('isBlobUnavailableError detects BlobStoreSuspendedError', () => {
    const err = new Error('Blob store is suspended');
    err.name = 'BlobStoreSuspendedError';
    assert.equal(isBlobUnavailableError(err), true);
});

test('isBlobUnavailableError detects 403 blob errors', () => {
    const err = new Error('Forbidden blob access');
    err.statusCode = 403;
    assert.equal(isBlobUnavailableError(err), true);
});

test('toBlobStorageUnavailableError wraps suspended errors', () => {
    const original = new Error('Blob store is suspended');
    original.name = 'BlobStoreSuspendedError';
    const wrapped = toBlobStorageUnavailableError(original);
    assert.ok(wrapped instanceof BlobStorageUnavailableError);
});

test('getBlobUnavailablePayload includes code', () => {
    const payload = getBlobUnavailablePayload();
    assert.equal(payload.code, 'BLOB_UNAVAILABLE');
    assert.match(payload.error, /suspendido/i);
});
