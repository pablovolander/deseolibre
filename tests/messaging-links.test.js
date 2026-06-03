const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizePhoneDigits,
    normalizeTelegramUsername,
    getWhatsAppUrl,
    getTelegramUrl
} = require('../lib/messaging-links');

test('normalizePhoneDigits adds Mexico country code to 10 digits', () => {
    assert.equal(normalizePhoneDigits('55 1234 5678'), '525512345678');
});

test('getWhatsAppUrl builds wa.me link', () => {
    assert.equal(getWhatsAppUrl('+52 55 1234 5678'), 'https://wa.me/525512345678');
});

test('getTelegramUrl builds t.me link from phone', () => {
    assert.equal(getTelegramUrl('5512345678'), 'https://t.me/+525512345678');
});

test('getTelegramUrl prefers username over phone', () => {
    assert.equal(getTelegramUrl('5512345678', 'mi_usuario'), 'https://t.me/mi_usuario');
});

test('normalizeTelegramUsername accepts empty username', () => {
    const result = normalizeTelegramUsername('');
    assert.equal(result.ok, true);
    assert.equal(result.telegram_username, '');
});

test('normalizeTelegramUsername strips @ and validates', () => {
    const result = normalizeTelegramUsername('@Ana_MX');
    assert.equal(result.ok, true);
    assert.equal(result.telegram_username, 'Ana_MX');
});
