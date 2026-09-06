const test = require('node:test');
const assert = require('node:assert/strict');

const {
    findCityBySlug,
    findCategoryBySlug,
    buildCityCategoryMeta,
    buildRobotsTxt,
    buildSitemapXml,
    injectSeoIntoHtml
} = require('../lib/seo');

test('findCityBySlug accepts primary and alias slugs', () => {
    assert.equal(findCityBySlug('cdmx').name, 'Ciudad de México');
    assert.equal(findCityBySlug('gdl').slug, 'guadalajara');
    assert.equal(findCityBySlug('nope'), null);
});

test('findCategoryBySlug maps feed categories', () => {
    assert.equal(findCategoryBySlug('mujeres').feedFile, 'feed-mujeres.html');
    assert.equal(findCategoryBySlug('hombres').category, 'acompañantes-hombres');
});

test('buildCityCategoryMeta includes city and category', () => {
    const city = findCityBySlug('monterrey');
    const category = findCategoryBySlug('trans');
    const meta = buildCityCategoryMeta(city, category);
    assert.match(meta.title, /Monterrey/);
    assert.match(meta.description, /Monterrey/);
    assert.equal(meta.canonicalPath, '/monterrey/trans');
    assert.equal(meta.cityName, 'Monterrey');
});

test('buildRobotsTxt references sitemap and blocks private paths', () => {
    const robots = buildRobotsTxt('https://deseolibre.vercel.app');
    assert.match(robots, /Sitemap: https:\/\/deseolibre\.vercel\.app\/sitemap\.xml/);
    assert.match(robots, /Disallow: \/api\//);
    assert.match(robots, /Disallow: \/admin-/);
});

test('buildSitemapXml includes city x category urls', () => {
    const xml = buildSitemapXml('https://deseolibre.vercel.app');
    assert.match(xml, /https:\/\/deseolibre\.vercel\.app\/cdmx\/mujeres/);
    assert.match(xml, /https:\/\/deseolibre\.vercel\.app\/guadalajara\/hombres/);
    assert.match(xml, /https:\/\/deseolibre\.vercel\.app\/monterrey\/trans/);
    assert.match(xml, /feed-mujeres\.html/);
});

test('injectSeoIntoHtml replaces title and hero copy', () => {
    const html = `<!DOCTYPE html><html><head><title>Old</title></head>
<body class="directory-page" data-category="acompañantes-mujeres">
<section class="directory-hero"><h1>Old H1</h1><p>Old text</p></section>
</body></html>`;
    const out = injectSeoIntoHtml(html, {
        title: 'Acompañantes mujeres en CDMX | Deseo Libre',
        description: 'Desc',
        canonicalPath: '/cdmx/mujeres',
        heroTitle: 'Mujeres en CDMX',
        heroText: 'Texto ciudad',
        cityName: 'Ciudad de México'
    });
    assert.match(out, /<title>Acompañantes mujeres en CDMX \| Deseo Libre<\/title>/);
    assert.match(out, /meta name="description" content="Desc"/);
    assert.match(out, /data-city="Ciudad de México"/);
    assert.match(out, /<h1>Mujeres en CDMX<\/h1>/);
    assert.match(out, /<p>Texto ciudad<\/p>/);
});
