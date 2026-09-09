const test = require('node:test');
const assert = require('node:assert/strict');

const {
    MAX_REEL_DURATION_SEC,
    parseReelDurationSeconds,
    buildReelTooLargeError,
    getReelUploadLimitBytes
} = require('../lib/reels');

test('parseReelDurationSeconds accepts empty and valid values', () => {
    assert.equal(parseReelDurationSeconds('').ok, true);
    assert.equal(parseReelDurationSeconds('45').value, 45);
    assert.equal(parseReelDurationSeconds(String(MAX_REEL_DURATION_SEC)).ok, true);
});

test('parseReelDurationSeconds rejects over limit', () => {
    const result = parseReelDurationSeconds(MAX_REEL_DURATION_SEC + 1);
    assert.equal(result.ok, false);
    assert.match(result.error, /60/);
});

test('buildReelTooLargeError mentions limit', () => {
    assert.match(buildReelTooLargeError(4.5 * 1024 * 1024), /4\.5 MB/);
});

test('getReelUploadLimitBytes is tighter on serverless', () => {
    assert.ok(getReelUploadLimitBytes(true) < getReelUploadLimitBytes(false));
});
