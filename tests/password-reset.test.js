const test = require('node:test');
const assert = require('node:assert/strict');

const {
    hashResetToken,
    generateResetToken,
    isValidEmail,
    validateNewPassword,
    buildResetUrl,
    buildResetEmailHtml,
    isResetTokenExpired,
    isResendConfigured
} = require('../lib/password-reset');

test('generateResetToken returns unique hex strings', () => {
    const a = generateResetToken();
    const b = generateResetToken();
    assert.notEqual(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
});

test('hashResetToken is deterministic', () => {
    assert.equal(hashResetToken('abc'), hashResetToken('abc'));
    assert.notEqual(hashResetToken('abc'), hashResetToken('xyz'));
});

test('isValidEmail validates basic addresses', () => {
    assert.equal(isValidEmail('user@example.com'), true);
    assert.equal(isValidEmail('bad-email'), false);
});

test('validateNewPassword enforces minimum length', () => {
    assert.equal(validateNewPassword('12345').ok, false);
    assert.equal(validateNewPassword('123456').ok, true);
});

test('buildResetUrl includes encoded token', () => {
    const url = buildResetUrl('https://deseolibre.vercel.app', 'token/with+chars');
    assert.ok(url.startsWith('https://deseolibre.vercel.app/reset-password.html?token='));
});

test('buildResetEmailHtml escapes username', () => {
    const html = buildResetEmailHtml('https://example.com/reset', '<script>');
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
});

test('isResetTokenExpired detects past dates', () => {
    assert.equal(isResetTokenExpired(new Date(Date.now() - 1000).toISOString()), true);
    assert.equal(isResetTokenExpired(new Date(Date.now() + 60000).toISOString()), false);
});

test('isResendConfigured rejects placeholders', () => {
    const prev = process.env.RESEND_API_KEY;
    try {
        process.env.RESEND_API_KEY = '';
        assert.equal(isResendConfigured(), false);
        process.env.RESEND_API_KEY = 're_xxx';
        assert.equal(isResendConfigured(), false);
        process.env.RESEND_API_KEY = 're_' + 'a'.repeat(24);
        assert.equal(isResendConfigured(), true);
    } finally {
        if (prev === undefined) delete process.env.RESEND_API_KEY;
        else process.env.RESEND_API_KEY = prev;
    }
});
