const test = require('node:test');
const assert = require('node:assert/strict');
const {
    evaluateAutoVerification,
    validateFaceMatchScore,
    validateUploadedFile,
    MIN_FACE_MATCH_SCORE
} = require('../lib/auto-verification');

function mockFile(name, mimetype, size) {
    return { originalname: name, mimetype, size, buffer: Buffer.alloc(size) };
}

test('validateFaceMatchScore rejects missing score', () => {
    const result = validateFaceMatchScore(undefined);
    assert.equal(result.ok, false);
});

test('validateFaceMatchScore rejects low score', () => {
    const result = validateFaceMatchScore(0.1);
    assert.equal(result.ok, false);
});

test('validateFaceMatchScore accepts valid score', () => {
    const result = validateFaceMatchScore(0.55);
    assert.equal(result.ok, true);
    assert.equal(result.score, 0.55);
});

test('evaluateAutoVerification requires face match score', () => {
    const payload = {
        verification_type: 'id_card',
        country: 'MX',
        id_front: mockFile('front.jpg', 'image/jpeg', 20000),
        id_back: mockFile('back.jpg', 'image/jpeg', 20000),
        selfie: mockFile('selfie.jpg', 'image/jpeg', 20000),
        body_video: mockFile('body.mp4', 'video/mp4', 500000),
        body_video_duration_sec: 10,
        isVercel: false
    };

    const withoutFace = evaluateAutoVerification(payload);
    assert.equal(withoutFace.approved, false);

    const withFace = evaluateAutoVerification({
        ...payload,
        face_match_score: MIN_FACE_MATCH_SCORE + 0.1
    });
    assert.equal(withFace.approved, true);
    assert.ok(withFace.checks_passed.includes('face_match_browser'));
});

test('validateUploadedFile rejects tiny image', () => {
    const file = mockFile('x.jpg', 'image/jpeg', 100);
    const result = validateUploadedFile(file, { kind: 'image', isVercel: false });
    assert.equal(result.ok, false);
});
