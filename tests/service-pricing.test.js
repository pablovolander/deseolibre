const test = require('node:test');
const assert = require('node:assert/strict');
const {
    validatePhoneRequired,
    validateServicePrice,
    formatServicePrice,
    normalizePhone
} = require('../lib/service-pricing');

test('normalizePhone strips non-digits', () => {
    assert.equal(normalizePhone('+52 (55) 1234-5678'), '525512345678');
});

test('validatePhoneRequired rejects short numbers', () => {
    const result = validatePhoneRequired('123');
    assert.equal(result.ok, false);
});

test('validatePhoneRequired accepts valid phone', () => {
    const result = validatePhoneRequired('+52 555 123 4567');
    assert.equal(result.ok, true);
    assert.equal(result.phone, '+52 555 123 4567');
});

test('validateServicePrice requires positive amount', () => {
    assert.equal(validateServicePrice(0, 'hour').ok, false);
    assert.equal(validateServicePrice(-10, 'hour').ok, false);
});

test('validateServicePrice requires hour or half_hour unit', () => {
    assert.equal(validateServicePrice(500, 'hour').ok, true);
    assert.equal(validateServicePrice(500, 'half_hour').ok, true);
    assert.equal(validateServicePrice(500, 'day').ok, false);
});

test('formatServicePrice shows unit label', () => {
    assert.match(formatServicePrice(1500, 'hour'), /hora/);
    assert.match(formatServicePrice(800, 'half_hour'), /30 min/);
});
