const test = require('node:test');
const assert = require('node:assert/strict');
const {
    validateOfferedServices,
    resolveServiceLabels,
    parseOfferedServices,
    userHasRequiredServices,
    postOffersService
} = require('../lib/service-catalog');

test('validateOfferedServices requires modality and experience for mujeres', () => {
    const bad = validateOfferedServices('acompañantes-mujeres', ['hotel']);
    assert.equal(bad.ok, false);

    const ok = validateOfferedServices('acompañantes-mujeres', ['hotel', 'compania']);
    assert.equal(ok.ok, true);
    assert.deepEqual(ok.offered_services, ['hotel', 'compania']);
});

test('validateOfferedServices rejects unknown ids', () => {
    const result = validateOfferedServices('acompañantes-hombres', ['hotel', 'no_existe', 'compania']);
    assert.equal(result.ok, false);
});

test('resolveServiceLabels returns labels for trans identity tags', () => {
    const labels = resolveServiceLabels('acompañantes-trans', [
        'virtual',
        'compania',
        'trans_femenina'
    ]);
    assert.equal(labels.length, 3);
    assert.equal(labels[2].label, 'Mujer trans');
});

test('userHasRequiredServices checks minimum selections', () => {
    assert.equal(
        userHasRequiredServices({
            category: 'acompañantes-mujeres',
            offered_services: '["hotel","compania"]'
        }),
        true
    );
    assert.equal(
        userHasRequiredServices({
            category: 'acompañantes-mujeres',
            offered_services: '["hotel"]'
        }),
        false
    );
});

test('postOffersService filters by service id', () => {
    const post = { offered_services: '["hotel","compania"]' };
    assert.equal(postOffersService(post, 'hotel'), true);
    assert.equal(postOffersService(post, 'virtual'), false);
    assert.equal(parseOfferedServices(post.offered_services).length, 2);
});
