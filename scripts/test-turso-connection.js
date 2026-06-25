#!/usr/bin/env node
/**
 * Prueba conexión a Turso y muestra resumen de tablas.
 */
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');

const root = path.join(__dirname, '..');
const envLocal = path.join(root, '.env.local');
if (fs.existsSync(envLocal)) {
    require('dotenv').config({ path: envLocal });
}

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

async function main() {
    if (!url || !token) {
        console.error('Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en .env.local');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });
    await client.execute('SELECT 1');
    console.log('Conexión OK');

    const tables = await client.execute(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    );

    for (const row of tables.rows) {
        const name = row.name || row[0];
        const count = await client.execute(`SELECT COUNT(*) AS c FROM "${name}"`);
        const c = count.rows[0]?.c ?? count.rows[0]?.[0] ?? 0;
        console.log(`  ${name}: ${c} filas`);
    }
}

main().catch((error) => {
    console.error('Fallo:', error.message);
    process.exit(1);
});
