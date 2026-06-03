const test = require('node:test');
const assert = require('node:assert/strict');
const {
    generateChallengeCode,
    normalizeChallengeCode,
    codesMatch,
    isChallengeExpired,
    CODE_PREFIX
} = require('../lib/public-video-challenge');
const { validatePublicBodyVideoUpload, userHasPublicBodyVideo } = require('../lib/public-body-video');

test('generateChallengeCode uses DL- prefix', () => {
    const code = generateChallengeCode();
    assert.match(code, /^DL-[23456789A-Z]{4}$/);
    assert.ok(code.startsWith(CODE_PREFIX));
});

test('codesMatch accepts spacing and case differences', () => {
    assert.equal(codesMatch('DL-A7K2', 'dl a7k2'), true);
    assert.equal(codesMatch('DL-A7K2', 'DLA7K2'), true);
    assert.equal(codesMatch('DL-A7K2', 'DL-B9M3'), false);
});

test('isChallengeExpired detects past dates', () => {
    assert.equal(isChallengeExpired(new Date(Date.now() - 1000).toISOString()), true);
    assert.equal(isChallengeExpired(new Date(Date.now() + 60000).toISOString()), false);
});

test('validatePublicBodyVideoUpload requires matching code', () => {
    const file = { mimetype: 'video/mp4', size: 500000, originalname: 'v.mp4' };
    const ok = validatePublicBodyVideoUpload({
        file,
        durationSec: 10,
        detectedCode: 'DL-A7K2',
        expectedCode: 'DL-A7K2',
        isVercel: false
    });
    assert.equal(ok.ok, true);

    const bad = validatePublicBodyVideoUpload({
        file,
        durationSec: 10,
        detectedCode: 'DL-WRONG',
        expectedCode: 'DL-A7K2',
        isVercel: false
    });
    assert.equal(bad.ok, false);
});

test('userHasPublicBodyVideo checks public or legacy url', () => {
    assert.equal(userHasPublicBodyVideo({ public_body_video_url: '/uploads/v.mp4' }), true);
    assert.equal(userHasPublicBodyVideo({ body_verification_video_url: '/uploads/old.mp4' }), true);
    assert.equal(userHasPublicBodyVideo({}), false);
});
