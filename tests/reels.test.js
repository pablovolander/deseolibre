const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MAX_REEL_DURATION_SEC,
    parseReelDurationSeconds,
    buildReelTooLargeError,
    getReelUploadLimitBytes,
    isAllowedReelFile,
    pickReelMedia,
    normalizeReelTitle,
    isRecentReel
} = require('../lib/reels');

test('isAllowedReelFile accepts photos and videos in their own fields', () => {
    assert.equal(isAllowedReelFile('video', 'clip.MP4'), true);
    assert.equal(isAllowedReelFile('image', 'foto.jpeg'), true);
    assert.equal(isAllowedReelFile('image', 'clip.mp4'), false);
    assert.equal(isAllowedReelFile('video', 'foto.png'), false);
    assert.equal(isAllowedReelFile('other', 'foto.png'), false);
});

test('pickReelMedia prefers video and falls back to image', () => {
    const video = { originalname: 'a.mp4' };
    const image = { originalname: 'a.jpg' };
    assert.deepEqual(pickReelMedia({ video: [video], image: [image] }), { file: video, mediaType: 'video' });
    assert.deepEqual(pickReelMedia({ image: [image] }), { file: image, mediaType: 'image' });
    assert.equal(pickReelMedia({}), null);
    assert.equal(pickReelMedia(undefined), null);
});

test('normalizeReelTitle makes the title optional', () => {
    assert.equal(normalizeReelTitle(undefined), '');
    assert.equal(normalizeReelTitle('  Hola  '), 'Hola');
    assert.equal(normalizeReelTitle('x'.repeat(200)).length, 120);
});

test('isRecentReel handles SQLite timestamps within 24 hours', () => {
    const now = Date.parse('2026-09-28T12:00:00Z');
    assert.equal(isRecentReel('2026-09-28 01:00:00', now), true);
    assert.equal(isRecentReel('2026-09-27 11:00:00', now), false);
    assert.equal(isRecentReel('2026-09-28T10:00:00.000Z', now), true);
    assert.equal(isRecentReel(null, now), false);
    assert.equal(isRecentReel('not a date', now), false);
});

test('parseReelDurationSeconds accepts empty and valid values', () => {
    assert.equal(parseReelDurationSeconds('').ok, true);
    assert.equal(parseReelDurationSeconds('45').value, 45);
    assert.equal(parseReelDurationSeconds(String(MAX_REEL_DURATION_SEC)).ok, true);
});

test('parseReelDurationSeconds rejects over limit', () => {
    const result = parseReelDurationSeconds(MAX_REEL_DURATION_SEC + 1);
    assert.equal(result.ok, false);
    assert.match(result.error, /45/);
});

test('buildReelTooLargeError mentions limit', () => {
    assert.match(buildReelTooLargeError(4.5 * 1024 * 1024), /4\.5 MB/);
});

test('getReelUploadLimitBytes is tighter on serverless', () => {
    assert.ok(getReelUploadLimitBytes(true) < getReelUploadLimitBytes(false));
});
