const test = require('node:test');
const assert = require('node:assert/strict');
const {
    resolveCityQuery,
    resolveZoneQuery,
    validateCountryCityZone,
    postMatchesLocation,
    listSupportedCities,
    listZonesForCity,
    isOtherZone
} = require('../lib/supported-locations');

test('only three active cities', () => {
    const cities = listSupportedCities('MX');
    assert.equal(cities.length, 3);
});

test('resolveZoneQuery finds Polanco in CDMX', () => {
    const result = resolveZoneQuery('Ciudad de México', 'polanco');
    assert.equal(result.ok, true);
    assert.equal(result.zone, 'Polanco');
});

test('validateCountryCityZone requires detail for other zone', () => {
    const bad = validateCountryCityZone('MX', 'Ciudad de México', 'Otra zona (CDMX)', '');
    assert.equal(bad.ok, false);
    const good = validateCountryCityZone('MX', 'Ciudad de México', 'Polanco', 'Cerca de Antara');
    assert.equal(good.ok, true);
    assert.equal(good.zone, 'Polanco');
    assert.equal(good.zone_detail, 'Cerca de Antara');
});

test('postMatchesLocation filters by city and zone', () => {
    const post = {
        city: 'Ciudad de México',
        country: 'MX',
        zone: 'Polanco',
        zone_detail: 'Antara',
        location: '',
        bio: '',
        description: '',
        title: ''
    };
    assert.equal(postMatchesLocation(post, 'cdmx', 'Polanco'), true);
    assert.equal(postMatchesLocation(post, 'cdmx', 'Roma Norte'), false);
    assert.equal(postMatchesLocation(post, 'cdmx', ''), true);
});

test('isOtherZone detects otra zona entries', () => {
    assert.equal(isOtherZone('Otra zona (CDMX)'), true);
    assert.equal(isOtherZone('Polanco'), false);
});

test('listZonesForCity returns zones for Guadalajara', () => {
    const zones = listZonesForCity('Guadalajara');
    assert.ok(zones.length >= 10);
    assert.ok(zones.some((z) => z.name.includes('Zapopan')));
});
