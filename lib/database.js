const sqlite3 = require('sqlite3').verbose();

function usesTursoDatabase() {
    return Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
}

function shouldPersistDatabaseToBlob(isVercel) {
    return Boolean(isVercel && process.env.BLOB_READ_WRITE_TOKEN && !usesTursoDatabase());
}

function normalizeParams(params) {
    if (params == null) {
        return [];
    }
    return Array.isArray(params) ? params : [params];
}

function isIgnorableSchemaError(error) {
    const message = String(error?.message || '').toLowerCase();
    return message.includes('duplicate column');
}

function rowFromLibsqlResult(result) {
    if (!result || !result.rows || !result.rows.length) {
        return undefined;
    }
    const row = result.rows[0];
    if (row && typeof row === 'object' && !Array.isArray(row)) {
        return row;
    }
    const columns = result.columns || [];
    const values = Array.isArray(row) ? row : Object.values(row);
    const mapped = {};
    columns.forEach((column, index) => {
        mapped[column] = values[index];
    });
    return mapped;
}

function rowsFromLibsqlResult(result) {
    if (!result || !result.rows) {
        return [];
    }
    if (!result.rows.length) {
        return [];
    }
    const first = result.rows[0];
    if (first && typeof first === 'object' && !Array.isArray(first)) {
        return result.rows;
    }
    const columns = result.columns || [];
    return result.rows.map((row) => {
        const values = Array.isArray(row) ? row : Object.values(row);
        const mapped = {};
        columns.forEach((column, index) => {
            mapped[column] = values[index];
        });
        return mapped;
    });
}

class TursoDatabase {
    constructor(client) {
        this.client = client;
        this.queue = Promise.resolve();
    }

    serialize(callback) {
        callback();
    }

    enqueue(task) {
        const result = this.queue.then(() => task());
        // Keep the serial queue alive after a failed statement (e.g. duplicate column migrations).
        this.queue = result.catch(() => {});
        return result;
    }

    run(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        this.enqueue(async () => {
            const result = await this.client.execute({
                sql,
                args: normalizeParams(params)
            });
            const context = {
                lastID: Number(result.lastInsertRowid || 0),
                changes: Number(result.rowsAffected || 0)
            };
            if (callback) {
                callback.call(context, null);
            }
        }).catch((error) => {
            if (callback) {
                callback.call({ lastID: 0, changes: 0 }, error);
            }
        });
    }

    get(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        this.enqueue(async () => {
            const result = await this.client.execute({
                sql,
                args: normalizeParams(params)
            });
            if (callback) {
                callback(null, rowFromLibsqlResult(result));
            }
        }).catch((error) => {
            if (callback) {
                callback(error);
            }
        });
    }

    all(sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        this.enqueue(async () => {
            const result = await this.client.execute({
                sql,
                args: normalizeParams(params)
            });
            if (callback) {
                callback(null, rowsFromLibsqlResult(result));
            }
        }).catch((error) => {
            if (callback) {
                callback(error);
            }
        });
    }

    close(callback) {
        if (typeof callback === 'function') {
            callback(null);
        }
    }
}

async function createDatabaseConnection(dbPath) {
    if (usesTursoDatabase()) {
        const { createClient } = require('@libsql/client');
        const client = createClient({
            url: process.env.TURSO_DATABASE_URL,
            authToken: process.env.TURSO_AUTH_TOKEN
        });
        await client.execute('SELECT 1');
        return {
            db: new TursoDatabase(client),
            mode: 'turso'
        };
    }

    const db = new sqlite3.Database(dbPath);
    return {
        db,
        mode: 'file'
    };
}

function getDatabaseModeLabel(mode) {
    if (mode === 'turso') {
        return 'turso';
    }
    return 'file';
}

module.exports = {
    usesTursoDatabase,
    shouldPersistDatabaseToBlob,
    createDatabaseConnection,
    getDatabaseModeLabel,
    isIgnorableSchemaError,
    TursoDatabase
};
