/**
 * Datos del profesional en tarjetas de directorio y feeds.
 */
window.DeseoListing = (function () {
    const COUNTRY_LABELS = { MX: 'México' };

    function getName(post) {
        return post.full_name || post.display_name || post.username || 'Profesional';
    }

    function getLocation(post) {
        if (post.city && post.country) {
            const country = COUNTRY_LABELS[post.country] || post.country;
            return `${post.city}, ${country}`;
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

    return {
        getName,
        getLocation,
        getPrice,
        getPhone,
        getTelegramUsername,
        getMessagingLinksHtml,
        COUNTRY_LABELS
    };
})();
