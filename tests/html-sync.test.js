const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

// Vercel only bundles root *.html into the server function, and resolveHtmlPath
// serves the root copy first, so public/*.html duplicates must stay identical.
test('root HTML pages match their public/ copies', () => {
    const normalize = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const outOfSync = fs.readdirSync(publicDir)
        .filter((name) => name.endsWith('.html'))
        .filter((name) => fs.existsSync(path.join(rootDir, name)))
        .filter((name) => {
            const pub = normalize(fs.readFileSync(path.join(publicDir, name), 'utf8'));
            const root = normalize(fs.readFileSync(path.join(rootDir, name), 'utf8'));
            return pub !== root;
        });
    assert.deepEqual(outOfSync, [], `Copy public/<file> to the repo root: ${outOfSync.join(', ')}`);
});
