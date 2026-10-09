const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const mediaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deseo-media-'));

function withMediaRoot(fn) {
    return async () => {
        const saved = { MEDIA_ROOT: process.env.MEDIA_ROOT, BLOB: process.env.BLOB_READ_WRITE_TOKEN };
        process.env.MEDIA_ROOT = mediaRoot;
        delete process.env.BLOB_READ_WRITE_TOKEN;
        try {
            await fn(require('../lib/media-storage'));
        } finally {
            if (saved.MEDIA_ROOT === undefined) delete process.env.MEDIA_ROOT; else process.env.MEDIA_ROOT = saved.MEDIA_ROOT;
            if (saved.BLOB !== undefined) process.env.BLOB_READ_WRITE_TOKEN = saved.BLOB;
        }
    };
}

test('usesLocalMediaRoot only when MEDIA_ROOT is set and no Blob token', withMediaRoot((m) => {
    assert.equal(m.usesLocalMediaRoot(), true);
    process.env.BLOB_READ_WRITE_TOKEN = 'x';
    assert.equal(m.usesLocalMediaRoot(), false);
    delete process.env.BLOB_READ_WRITE_TOKEN;
}));

test('resolveMediaRootPath rejects traversal and non-uploads paths', withMediaRoot((m) => {
    assert.ok(m.resolveMediaRootPath('uploads/posts/1/a.jpg').startsWith(mediaRoot));
    assert.equal(m.resolveMediaRootPath('uploads/../secret.txt'), null);
    assert.equal(m.resolveMediaRootPath('etc/passwd'), null);
}));

test('persistUploadedFile writes to MEDIA_ROOT and returns media proxy path', withMediaRoot(async (m) => {
    const url = await m.persistUploadedFile(
        { originalname: 'foto.jpg', buffer: Buffer.from('hola'), mimetype: 'image/jpeg' },
        false,
        null
    );
    assert.match(url, /^\/api\/media\/uploads\/\d+-\d+-foto\.jpg$/);
    const stored = path.join(mediaRoot, decodeURIComponent(url.replace('/api/media/', '')));
    assert.equal(fs.readFileSync(stored, 'utf8'), 'hola');
}));

test('saveStreamToMediaRoot saves stream and enforces max size', withMediaRoot(async (m) => {
    const saved = await m.saveStreamToMediaRoot('uploads/reels/7/v.mp4', Readable.from([Buffer.from('abc')]), 10);
    assert.equal(saved.size, 3);
    assert.equal(fs.readFileSync(path.join(mediaRoot, 'uploads/reels/7/v.mp4'), 'utf8'), 'abc');

    await assert.rejects(
        m.saveStreamToMediaRoot('uploads/reels/7/big.mp4', Readable.from([Buffer.alloc(20)]), 10),
        /supera/
    );
    assert.equal(fs.existsSync(path.join(mediaRoot, 'uploads/reels/7/big.mp4')), false);
}));

test('active file types (html, svg, js) are rejected', withMediaRoot(async (m) => {
    assert.equal(m.resolveMediaRootPath('uploads/posts/1/x.html'), null);
    assert.equal(m.resolveMediaRootPath('uploads/posts/1/x.SVG'), null);
    await assert.rejects(
        m.persistUploadedFile({ originalname: 'evil.html', buffer: Buffer.from('<script>'), mimetype: 'text/html' }, false, null),
        /no permitido/
    );
}));

test('verification files go to a protected folder and need a valid signature', withMediaRoot(async (m) => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    const url = await m.persistUploadedFile(
        { originalname: 'ine.jpg', buffer: Buffer.from('doc'), mimetype: 'image/jpeg' },
        false,
        null,
        { folder: 'verification/42' }
    );
    assert.match(url, /^\/api\/media\/uploads\/verification\/42\//);
    const pathname = decodeURIComponent(url.replace('/api/media/', ''));
    assert.equal(m.isProtectedMediaPath(pathname), true);
    assert.equal(m.isProtectedMediaPath('uploads/posts/1/a.jpg'), false);

    const signed = new URL(m.signMediaUrl(url), 'http://x');
    assert.equal(m.verifyMediaSignature(pathname, signed.searchParams.get('exp'), signed.searchParams.get('sig')), true);
    assert.equal(m.verifyMediaSignature(pathname, signed.searchParams.get('exp'), 'forged'), false);
    assert.equal(m.verifyMediaSignature('uploads/verification/43/other.jpg', signed.searchParams.get('exp'), signed.searchParams.get('sig')), false);
    assert.equal(m.verifyMediaSignature(pathname, String(Math.floor(Date.now() / 1000) - 10), signed.searchParams.get('sig')), false);
    assert.equal(m.signMediaUrl('/api/media/uploads/posts/1/a.jpg'), '/api/media/uploads/posts/1/a.jpg');
}));
