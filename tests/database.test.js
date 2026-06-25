const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    usesTursoDatabase,
    shouldPersistDatabaseToBlob,
    getDatabaseModeLabel
} = require('../lib/database');

test('usesTursoDatabase requires url and token', () => {
    const originalUrl = process.env.TURSO_DATABASE_URL;
    const originalToken = process.env.TURSO_AUTH_TOKEN;
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    assert.equal(usesTursoDatabase(), false);

    process.env.TURSO_DATABASE_URL = 'libsql://example.turso.io';
    assert.equal(usesTursoDatabase(), false);

    process.env.TURSO_AUTH_TOKEN = 'token';
    assert.equal(usesTursoDatabase(), true);

    if (originalUrl) {
        process.env.TURSO_DATABASE_URL = originalUrl;
    } else {
        delete process.env.TURSO_DATABASE_URL;
    }
    if (originalToken) {
        process.env.TURSO_AUTH_TOKEN = originalToken;
    } else {
        delete process.env.TURSO_AUTH_TOKEN;
    }
});

test('shouldPersistDatabaseToBlob is false when Turso is configured', () => {
    const envBackup = { ...process.env };
    process.env.BLOB_READ_WRITE_TOKEN = 'blob-token';
    process.env.TURSO_DATABASE_URL = 'libsql://example.turso.io';
    process.env.TURSO_AUTH_TOKEN = 'token';
    assert.equal(shouldPersistDatabaseToBlob(true), false);
    Object.assign(process.env, envBackup);
});

test('getDatabaseModeLabel maps modes', () => {
    assert.equal(getDatabaseModeLabel('turso'), 'turso');
    assert.equal(getDatabaseModeLabel('file'), 'file');
});
