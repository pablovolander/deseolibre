/**
 * SEO mínimo: meta pages, robots.txt y sitemap (ciudad × categoría).
 */

const SITE_NAME = 'Deseo Libre';
const DEFAULT_BASE_URL = 'https://deseolibre.vercel.app';

const CITY_PAGES = [
    {
        slug: 'cdmx',
        name: 'Ciudad de México',
        short: 'CDMX',
        aliases: ['ciudad-de-mexico', 'mexico-df']
    },
    {
        slug: 'guadalajara',
        name: 'Guadalajara',
        short: 'Guadalajara',
        aliases: ['gdl']
    },
    {
        slug: 'monterrey',
        name: 'Monterrey',
        short: 'Monterrey',
        aliases: ['mty']
    }
];

const CATEGORY_PAGES = [
    {
        slug: 'mujeres',
        label: 'Acompañantes mujeres',
        labelShort: 'Mujeres',
        category: 'acompañantes-mujeres',
        feedFile: 'feed-mujeres.html',
        emoji: '👩'
    },
    {
        slug: 'hombres',
        label: 'Acompañantes hombres',
        labelShort: 'Hombres',
        category: 'acompañantes-hombres',
        feedFile: 'feed-hombres.html',
        emoji: '👨'
    },
    {
        slug: 'trans',
        label: 'Acompañantes trans',
        labelShort: 'Trans',
        category: 'acompañantes-trans',
        feedFile: 'feed-trans.html',
        emoji: '⚧️'
    }
];

function getSeoBaseUrl() {
    const configured = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
    if (configured) {
        return configured;
    }
    const vercelUrl = String(process.env.VERCEL_URL || '').trim();
    if (vercelUrl) {
        return `https://${vercelUrl.replace(/^https?:\/\//, '')}`;
    }
    return DEFAULT_BASE_URL;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function findCityBySlug(slug) {
    const key = String(slug || '').trim().toLowerCase();
    return CITY_PAGES.find((city) => city.slug === key || (city.aliases || []).includes(key)) || null;
}

function findCategoryBySlug(slug) {
    const key = String(slug || '').trim().toLowerCase();
    return CATEGORY_PAGES.find((cat) => cat.slug === key) || null;
}

function buildCityCategoryPath(citySlug, categorySlug) {
    return `/${citySlug}/${categorySlug}`;
}

function buildHomeMeta() {
    return {
        title: `${SITE_NAME} — Directorio de acompañantes en México`,
        description:
            'Directorio de acompañantes en CDMX, Guadalajara y Monterrey. Perfiles con verificación, contacto directo y 0% de comisión.',
        canonicalPath: '/'
    };
}

function buildCategoryMeta(category) {
    return {
        title: `${category.label} en México | ${SITE_NAME}`,
        description: `${category.label} en CDMX, Guadalajara y Monterrey. Busca por zona, verifica perfiles y contacta directo. 0% comisión.`,
        canonicalPath: `/${category.feedFile}`,
        heroTitle: `${category.emoji} ${category.label}`,
        heroText: 'CDMX, Guadalajara y Monterrey — busca por zona. Verificación, 0% comisión y contacto directo.'
    };
}

function buildCityCategoryMeta(city, category) {
    const path = buildCityCategoryPath(city.slug, category.slug);
    return {
        title: `${category.label} en ${city.short} | ${SITE_NAME}`,
        description: `${category.label} en ${city.name}. Directorio con verificación, búsqueda por zona, contacto directo y 0% de comisión.`,
        canonicalPath: path,
        heroTitle: `${category.emoji} ${category.label} en ${city.short}`,
        heroText: `Anuncios en ${city.name}. Filtra por zona, verifica perfiles y contacta sin intermediarios.`,
        cityName: city.name
    };
}

function buildMetaTagsHtml({ title, description, canonicalUrl, noindex = false }) {
    const robots = noindex ? 'noindex, nofollow' : 'index, follow';
    return [
        `<title>${escapeHtml(title)}</title>`,
        `<meta name="description" content="${escapeHtml(description)}">`,
        `<meta name="robots" content="${robots}">`,
        `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
        `<meta property="og:type" content="website">`,
        `<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
        `<meta property="og:title" content="${escapeHtml(title)}">`,
        `<meta property="og:description" content="${escapeHtml(description)}">`,
        `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
        `<meta name="twitter:card" content="summary">`,
        `<meta name="twitter:title" content="${escapeHtml(title)}">`,
        `<meta name="twitter:description" content="${escapeHtml(description)}">`
    ].join('\n    ');
}

function stripExistingSeoTags(html) {
    return String(html || '')
        .replace(/<title>[^<]*<\/title>\s*/gi, '')
        .replace(/<meta\s+name=["']description["'][^>]*>\s*/gi, '')
        .replace(/<meta\s+name=["']robots["'][^>]*>\s*/gi, '')
        .replace(/<link\s+rel=["']canonical["'][^>]*>\s*/gi, '')
        .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>\s*/gi, '')
        .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>\s*/gi, '');
}

function injectSeoIntoHtml(html, seo) {
    const baseUrl = getSeoBaseUrl();
    const canonicalUrl = `${baseUrl}${seo.canonicalPath || '/'}`;
    const metaBlock = buildMetaTagsHtml({
        title: seo.title,
        description: seo.description,
        canonicalUrl,
        noindex: Boolean(seo.noindex)
    });

    let next = stripExistingSeoTags(html);
    if (/<meta\s+name=["']viewport["'][^>]*>/i.test(next)) {
        next = next.replace(
            /(<meta\s+name=["']viewport["'][^>]*>)/i,
            `$1\n    ${metaBlock}`
        );
    } else if (/<\/head>/i.test(next)) {
        next = next.replace(/<\/head>/i, `    ${metaBlock}\n</head>`);
    } else {
        next = `${metaBlock}\n${next}`;
    }

    if (seo.cityName) {
        next = next.replace(/\sdata-city=["'][^"']*["']/i, '');
        next = next.replace(
            /(<body[^>]*class="[^"]*directory-page[^"]*")([^>]*>)/i,
            `$1 data-city="${escapeHtml(seo.cityName)}"$2`
        );
        if (!/\sdata-city=/.test(next)) {
            next = next.replace(/<body([^>]*)>/i, `<body$1 data-city="${escapeHtml(seo.cityName)}">`);
        }
    }

    if (seo.heroTitle) {
        next = next.replace(
            /(<section class="directory-hero">\s*<h1>)([\s\S]*?)(<\/h1>)/i,
            `$1${escapeHtml(seo.heroTitle)}$3`
        );
    }
    if (seo.heroText) {
        next = next.replace(
            /(<section class="directory-hero">[\s\S]*?<h1>[\s\S]*?<\/h1>\s*<p>)([\s\S]*?)(<\/p>)/i,
            `$1${escapeHtml(seo.heroText)}$3`
        );
    }

    return next;
}

function buildRobotsTxt(baseUrl = getSeoBaseUrl()) {
    const origin = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    return [
        'User-agent: *',
        'Allow: /',
        'Allow: /feed-mujeres.html',
        'Allow: /feed-hombres.html',
        'Allow: /feed-trans.html',
        'Allow: /policies.html',
        'Allow: /cdmx/',
        'Allow: /guadalajara/',
        'Allow: /monterrey/',
        'Disallow: /api/',
        'Disallow: /admin-',
        'Disallow: /profile.html',
        'Disallow: /create-post.html',
        'Disallow: /verificar-identidad.html',
        'Disallow: /reset-password.html',
        'Disallow: /reels-',
        `Sitemap: ${origin}/sitemap.xml`,
        ''
    ].join('\n');
}

function xmlEscape(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildSitemapXml(baseUrl = getSeoBaseUrl()) {
    const origin = String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    const today = new Date().toISOString().slice(0, 10);
    const urls = [
        { loc: `${origin}/`, changefreq: 'daily', priority: '1.0' },
        { loc: `${origin}/feed-mujeres.html`, changefreq: 'daily', priority: '0.9' },
        { loc: `${origin}/feed-hombres.html`, changefreq: 'daily', priority: '0.9' },
        { loc: `${origin}/feed-trans.html`, changefreq: 'daily', priority: '0.9' },
        { loc: `${origin}/policies.html`, changefreq: 'monthly', priority: '0.3' }
    ];

    for (const city of CITY_PAGES) {
        for (const category of CATEGORY_PAGES) {
            urls.push({
                loc: `${origin}${buildCityCategoryPath(city.slug, category.slug)}`,
                changefreq: 'daily',
                priority: '0.8'
            });
        }
    }

    const body = urls.map((entry) => [
        '  <url>',
        `    <loc>${xmlEscape(entry.loc)}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${entry.changefreq}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>'
    ].join('\n')).join('\n');

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        body,
        '</urlset>',
        ''
    ].join('\n');
}

module.exports = {
    SITE_NAME,
    DEFAULT_BASE_URL,
    CITY_PAGES,
    CATEGORY_PAGES,
    getSeoBaseUrl,
    findCityBySlug,
    findCategoryBySlug,
    buildCityCategoryPath,
    buildHomeMeta,
    buildCategoryMeta,
    buildCityCategoryMeta,
    buildMetaTagsHtml,
    injectSeoIntoHtml,
    buildRobotsTxt,
    buildSitemapXml
};
