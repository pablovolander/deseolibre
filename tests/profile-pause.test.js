const test = require('node:test');
const assert = require('node:assert/strict');

function isProfilePausedFlag(value) {
    return value === 1 || value === true || value === '1' || value === 'true';
}

test('isProfilePausedFlag accepts common truthy shapes', () => {
    assert.equal(isProfilePausedFlag(1), true);
    assert.equal(isProfilePausedFlag(true), true);
    assert.equal(isProfilePausedFlag('1'), true);
    assert.equal(isProfilePausedFlag(0), false);
    assert.equal(isProfilePausedFlag(null), false);
    assert.equal(isProfilePausedFlag(undefined), false);
});
