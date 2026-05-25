const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizePhoneDigits,
    getWhatsAppUrl,
    getTelegramUrl
} = require('../lib/messaging-links');

test('normalizePhoneDigits adds Mexico country code to 10 digits', () => {
    assert.equal(normalizePhoneDigits('55 1234 5678'), '525512345678');
});

test('getWhatsAppUrl builds wa.me link', () => {
    assert.equal(getWhatsAppUrl('+52 55 1234 5678'), 'https://wa.me/525512345678');
});

test('getTelegramUrl builds t.me link', () => {
    assert.equal(getTelegramUrl('5512345678'), 'https://t.me/+525512345678');
});
