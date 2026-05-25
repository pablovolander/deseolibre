const test = require('node:test');
const assert = require('node:assert/strict');
const { validateUserProfileFields, userHasCompleteProfile } = require('../lib/user-profile');
const { validateCountryCity } = require('../lib/supported-cities');

test('validateCountryCity rejects city from wrong country', () => {
    const result = validateCountryCity('MX', 'Bogotá');
    assert.equal(result.ok, false);
});

test('validateCountryCity accepts matching city', () => {
    const result = validateCountryCity('CO', 'Bogotá');
    assert.equal(result.ok, true);
    assert.equal(result.city, 'Bogotá');
});

test('validateUserProfileFields requires full profile', () => {
    const result = validateUserProfileFields({
        full_name: 'Ana',
        country: 'MX',
        city: 'Ciudad de México',
        phone: '+52 555 123 4567',
        service_price: 2000,
        service_price_unit: 'hour'
    });
    assert.equal(result.ok, true);
    assert.match(result.location, /Ciudad de México/);
});

test('userHasCompleteProfile detects missing fields', () => {
    assert.equal(userHasCompleteProfile({ full_name: 'Ana', country: 'MX', city: 'CDMX' }), false);
    assert.equal(
        userHasCompleteProfile({
            full_name: 'Ana',
            country: 'MX',
            city: 'Ciudad de México',
            phone: '+525551234567',
            service_price: 1000,
            service_price_unit: 'hour'
        }),
        true
    );
});
