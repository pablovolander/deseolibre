const test = require('node:test');
const assert = require('node:assert/strict');

const {
    normalizeStoredMediaUrl,
    uploadsPathToBlobProxy
} = require('../lib/media-storage');

test('uploadsPathToBlobProxy maps legacy /uploads paths to media proxy on serverless', () => {
    const previousVercel = process.env.VERCEL;
    process.env.VERCEL = '1';
    try {
        assert.equal(
            uploadsPathToBlobProxy('/uploads/photo-123.jpg'),
            '/api/media/uploads/photo-123.jpg'
        );
        assert.equal(
            uploadsPathToBlobProxy('uploads/video-456.mp4'),
            '/api/media/uploads/video-456.mp4'
        );
    } finally {
        if (previousVercel === undefined) {
            delete process.env.VERCEL;
        } else {
            process.env.VERCEL = previousVercel;
        }
    }
});

test('normalizeStoredMediaUrl keeps existing media proxy paths', () => {
    assert.equal(
        normalizeStoredMediaUrl('/api/media/uploads/photo-123.jpg'),
        '/api/media/uploads/photo-123.jpg'
    );
});

test('normalizeStoredMediaUrl rewrites public blob URLs to media proxy', () => {
    const url = 'https://abc.public.blob.vercel-storage.com/uploads/photo-123.jpg';
    assert.equal(
        normalizeStoredMediaUrl(url),
        '/api/media/uploads/photo-123.jpg'
    );
});
