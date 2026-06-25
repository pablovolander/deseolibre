#!/usr/bin/env node
/**
 * Copia deseo_libre.db local → Turso.
 * Requiere TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env.local
 */
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');

const root = path.join(__dirname, '..');
const envLocal = path.join(root, '.env.local');
if (fs.existsSync(envLocal)) {
    require('dotenv').config({ path: envLocal });
}

const dbPath = path.join(root, 'deseo_libre.db');
const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

function openLocalDb() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(db);
            }
        });
    });
}

function localAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

function localGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

function quoteIdent(name) {
    return `"${String(name).replace(/"/g, '""')}"`;
}

async function main() {
    if (!url || !token) {
        console.error('');
        console.error('Faltan variables en .env.local:');
        console.error('  TURSO_DATABASE_URL=libsql://...');
        console.error('  TURSO_AUTH_TOKEN=...');
        console.error('');
        console.error('Sigue docs/SETUP-TURSO.md para crearlas en https://turso.tech/app');
        process.exit(1);
    }

    if (!fs.existsSync(dbPath)) {
        console.error('No existe deseo_libre.db en la raíz del proyecto.');
        process.exit(1);
    }

    const turso = createClient({ url, authToken: token });
    const local = await openLocalDb();

    console.log('Conectando a Turso...');
    await turso.execute('SELECT 1');

    const tables = await localAll(
        local,
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`
    );

    if (!tables.length) {
        console.log('La base local no tiene tablas.');
        process.exit(0);
    }

    console.log(`Tablas locales: ${tables.map((t) => t.name).join(', ')}`);
    console.log('Creando esquema en Turso (IF NOT EXISTS)...');

    await turso.execute('PRAGMA foreign_keys=OFF');

    for (const { name } of tables) {
        const row = await localGet(
            local,
            `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
            [name]
        );
        if (!row?.sql) {
            continue;
        }
        let ddl = row.sql.trim();
        if (!/IF NOT EXISTS/i.test(ddl)) {
            ddl = ddl.replace(/CREATE TABLE/i, 'CREATE TABLE IF NOT EXISTS');
        }
        try {
            await turso.execute(ddl);
        } catch (error) {
            console.warn(`  DDL ${name}: ${error.message}`);
        }
    }

    console.log('Copiando datos...');
    let totalRows = 0;

    for (const { name } of tables) {
        const rows = await localAll(local, `SELECT * FROM ${quoteIdent(name)}`);
        if (!rows.length) {
            console.log(`  ${name}: 0 filas`);
            continue;
        }

        const columns = Object.keys(rows[0]);
        const colList = columns.map(quoteIdent).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT OR REPLACE INTO ${quoteIdent(name)} (${colList}) VALUES (${placeholders})`;

        for (const row of rows) {
            await turso.execute({
                sql,
                args: columns.map((col) => row[col])
            });
        }

        totalRows += rows.length;
        console.log(`  ${name}: ${rows.length} filas`);
    }

    local.close();
    console.log('');
    console.log(`Listo. ${totalRows} filas copiadas a Turso.`);
    console.log('Siguiente paso: añade las mismas variables en Vercel y redeploy.');
}

main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
