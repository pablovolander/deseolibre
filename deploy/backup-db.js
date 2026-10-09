// Writes a full SQL dump of the Turso database to stdout.
// Usage: node deploy/backup-db.js > dump.sql
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@libsql/client');

function sqlValue(value) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
        return `X'${Buffer.from(value instanceof ArrayBuffer ? value : value.buffer).toString('hex')}'`;
    }
    return `'${String(value).replace(/'/g, "''")}'`;
}

(async () => {
    const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    const schema = await db.execute(
        "SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' ORDER BY type = 'table' DESC, name"
    );
    const out = process.stdout;
    out.write('PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n');
    for (const item of schema.rows.filter((r) => r.type === 'table')) {
        out.write(`${item.sql};\n`);
        const rows = await db.execute(`SELECT * FROM "${item.name}"`);
        for (const row of rows.rows) {
            const values = rows.columns.map((col) => sqlValue(row[col])).join(',');
            out.write(`INSERT INTO "${item.name}" VALUES(${values});\n`);
        }
    }
    for (const item of schema.rows.filter((r) => r.type !== 'table')) {
        out.write(`${item.sql};\n`);
    }
    out.write('COMMIT;\n');
})().catch((error) => {
    console.error(error.message);
    process.exit(1);
});
