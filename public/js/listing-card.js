/**
 * Datos del profesional en tarjetas de directorio y feeds.
 */
window.DeseoListing = (function () {
    const COUNTRY_LABELS = { MX: 'México' };
    const CITY_SHORT = {
        'Ciudad de México': 'CDMX',
        Guadalajara: 'GDL',
        Monterrey: 'MTY'
    };

    function getName(post) {
        return post.full_name || post.display_name || post.username || 'Profesional';
    }

    function getCityShort(city) {
        return CITY_SHORT[city] || city || '';
    }

    function getLocation(post) {
        const zone = String(post.zone || '').trim();
        const city = post.city || '';
        const detail = String(post.zone_detail || '').trim();
        if (zone && city) {
            let line = `${zone} · ${getCityShort(city)}`;
            if (detail) {
                line = `${line} — ${detail}`;
            }
            return line;
        }
        if (city && post.country) {
            const country = COUNTRY_LABELS[post.country] || post.country;
            return `${city}, ${country}`;
        }
        return post.location || post.user_location || 'Ubicación no indicada';
    }

    function getPrice(post) {
        const amount = post.service_price ?? post.price;
        const unit = post.service_price_unit ?? post.price_unit;
        if (typeof DeseoPricing !== 'undefined') {
            return DeseoPricing.formatPrice(amount, unit);
        }
        if (amount && Number(amount) > 0) {
            return `$${Number(amount).toLocaleString('es')}`;
        }
        return 'Consultar';
    }

    function getPhone(post) {
        return String(post.phone || '').trim();
    }

    function getTelegramUsername(post) {
        return String(post.telegram_username || '').trim();
    }

    function getMessagingLinksHtml(post, options) {
        if (typeof DeseoContact !== 'undefined') {
            return DeseoContact.renderMessagingLinksHtml(
                {
                    phone: getPhone(post),
                    telegram_username: getTelegramUsername(post)
                },
                options
            );
        }
        return '';
    }

    /** Imagen principal en tarjeta del directorio: foto de perfil, luego fallback del anuncio. */
    function getDirectoryCardImage(post) {
        if (post.profile_picture) {
            return post.profile_picture;
        }
        if (post.content_type === 'video' && post.thumbnail_url) {
            return post.thumbnail_url;
        }
        return post.media_url || post.file_url || '';
    }

    return {
        getName,
        getLocation,
        getPrice,
        getPhone,
        getTelegramUsername,
        getMessagingLinksHtml,
        getDirectoryCardImage,
        COUNTRY_LABELS,
        CITY_SHORT
    };
})();
