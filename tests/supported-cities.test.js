const test = require('node:test');
const assert = require('node:assert/strict');
const {
    resolveCityQuery,
    postMatchesCity,
    listSupportedCities
} = require('../lib/supported-cities');

test('resolveCityQuery accepts aliases like CDMX', () => {
    const result = resolveCityQuery('cdmx');
    assert.equal(result.ok, true);
    assert.equal(result.city.name, 'Ciudad de México');
});

test('resolveCityQuery rejects unknown cities', () => {
    const result = resolveCityQuery('Madrid');
    assert.equal(result.ok, false);
});

test('postMatchesCity matches by city field', () => {
    const post = {
        city: 'Monterrey',
        country: 'MX',
        location: '',
        bio: '',
        description: '',
        title: ''
    };
    assert.equal(postMatchesCity(post, 'Monterrey'), true);
});

test('listSupportedCities filters by country', () => {
    const mx = listSupportedCities('MX');
    assert.equal(mx.length, 3);
    assert.ok(mx.every((c) => c.country === 'MX'));
});
