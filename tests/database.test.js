const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    usesTursoDatabase,
    shouldPersistDatabaseToBlob,
    getDatabaseModeLabel,
    isIgnorableSchemaError,
    TursoDatabase
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

test('isIgnorableSchemaError detects duplicate column failures', () => {
    assert.equal(
        isIgnorableSchemaError(new Error('SQLite error: duplicate column name: is_admin')),
        true
    );
    assert.equal(isIgnorableSchemaError(new Error('duplicate column')), true);
    assert.equal(isIgnorableSchemaError(new Error('no such table: users')), false);
});

test('TursoDatabase keeps queue alive after failed statement', async () => {
    const calls = [];
    const client = {
        execute: async ({ sql }) => {
            calls.push(sql);
            if (sql.includes('ADD COLUMN broken')) {
                throw new Error('SQLite error: duplicate column name: broken');
            }
            return { rows: [{ id: 1 }], columns: ['id'] };
        }
    };
    const db = new TursoDatabase(client);

    await new Promise((resolve, reject) => {
        db.run('ALTER TABLE users ADD COLUMN broken TEXT', [], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    }).catch(() => {});

    const row = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM users WHERE id = ?', [1], (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });

    assert.deepEqual(row, { id: 1 });
    assert.equal(calls.length, 2);
});
