const test = require('node:test');
const assert = require('node:assert/strict');
const { validateUserProfileFields, userHasCompleteProfile } = require('../lib/user-profile');
const { validateCountryCity } = require('../lib/supported-cities');

test('validateCountryCity rejects non-Mexico country', () => {
    const result = validateCountryCity('CO', 'Bogotá');
    assert.equal(result.ok, false);
});

test('validateCountryCity accepts Mexican city', () => {
    const result = validateCountryCity('MX', 'Guadalajara');
    assert.equal(result.ok, true);
    assert.equal(result.city, 'Guadalajara');
});

test('validateUserProfileFields requires category when flagged', () => {
    const missing = validateUserProfileFields({
        full_name: 'Ana',
        country: 'MX',
        city: 'Ciudad de México',
        zone: 'Polanco',
        phone: '+52 555 123 4567',
        service_price: 2000,
        service_price_unit: 'hour'
    }, { requireCategory: true });
    assert.equal(missing.ok, false);

    const ok = validateUserProfileFields({
        full_name: 'Ana',
        country: 'MX',
        city: 'Ciudad de México',
        zone: 'Polanco',
        phone: '+52 555 123 4567',
        service_price: 2000,
        service_price_unit: 'hour',
        category: 'acompañantes-hombres'
    }, { requireCategory: true });
    assert.equal(ok.ok, true);
    assert.equal(ok.category, 'acompañantes-hombres');
});

test('validateUserProfileFields requires full profile', () => {
    const result = validateUserProfileFields({
        full_name: 'Ana',
        country: 'MX',
        city: 'Ciudad de México',
        zone: 'Polanco',
        zone_detail: 'Cerca del parque',
        phone: '+52 555 123 4567',
        telegram_username: 'ana_mx',
        service_price: 2000,
        service_price_unit: 'hour'
    });
    assert.equal(result.ok, true);
    assert.match(result.location, /Polanco/);
    assert.equal(result.zone, 'Polanco');
    assert.equal(result.telegram_username, 'ana_mx');
});

test('validateUserProfileFields accepts profile without telegram', () => {
    const result = validateUserProfileFields({
        full_name: 'Ana',
        country: 'MX',
        city: 'Ciudad de México',
        zone: 'Polanco',
        zone_detail: 'Cerca del parque',
        phone: '+52 555 123 4567',
        telegram_username: '',
        service_price: 2000,
        service_price_unit: 'hour'
    });
    assert.equal(result.ok, true);
    assert.equal(result.telegram_username, '');
});

test('validateProfileCategory requires category on register', () => {
    const { validateProfileCategory } = require('../lib/content-category');
    assert.equal(validateProfileCategory('', true).ok, false);
    assert.equal(validateProfileCategory('acompañantes-trans', true).ok, true);
});

test('userHasCompleteProfile requires category', () => {
    assert.equal(
        userHasCompleteProfile({
            full_name: 'Ana',
            country: 'MX',
            city: 'Ciudad de México',
            zone: 'Condesa',
            phone: '+525551234567',
            service_price: 1000,
            service_price_unit: 'hour',
            offered_services: '["hotel","compania"]',
            public_body_video_url: '/uploads/public.mp4'
        }),
        false
    );
});

test('userHasCompleteProfile detects missing fields', () => {
    assert.equal(userHasCompleteProfile({ full_name: 'Ana', country: 'MX', city: 'CDMX' }), false);
    assert.equal(
        userHasCompleteProfile({
            full_name: 'Ana',
            country: 'MX',
            city: 'Ciudad de México',
            zone: 'Condesa',
            phone: '+525551234567',
            telegram_username: '',
            service_price: 1000,
            service_price_unit: 'hour',
            category: 'acompañantes-mujeres',
            offered_services: '["hotel","compania"]',
            public_body_video_url: '/uploads/public.mp4'
        }),
        true
    );
    assert.equal(
        userHasCompleteProfile({
            full_name: 'Ana',
            country: 'MX',
            city: 'Ciudad de México',
            zone: 'Condesa',
            phone: '+525551234567',
            telegram_username: 'ana_mx',
            service_price: 1000,
            service_price_unit: 'hour',
            category: 'acompañantes-mujeres',
            offered_services: '["hotel","compania"]',
            public_body_video_url: '/uploads/public.mp4'
        }),
        true
    );
    assert.equal(
        userHasCompleteProfile({
            full_name: 'Ana',
            country: 'MX',
            city: 'Ciudad de México',
            zone: 'Condesa',
            phone: '+525551234567',
            service_price: 1000,
            service_price_unit: 'hour',
            category: 'acompañantes-mujeres',
            offered_services: '["hotel"]',
            public_body_video_url: '/uploads/public.mp4'
        }),
        false
    );
});
