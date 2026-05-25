/**
 * Enlaces WhatsApp y Telegram a partir del teléfono del perfil.
 */
window.DeseoContact = (function () {
    const DEFAULT_COUNTRY = '52';

    function normalizeDigits(phone) {
        let digits = String(phone || '').replace(/\D/g, '');
        if (!digits) {
            return '';
        }
        if (digits.length === 10) {
            digits = `${DEFAULT_COUNTRY}${digits}`;
        } else if (digits.length === 11 && digits.startsWith('1')) {
            digits = digits.slice(1);
            if (digits.length === 10) {
                digits = `${DEFAULT_COUNTRY}${digits}`;
            }
        }
        return digits;
    }

    function whatsAppUrl(phone) {
        const digits = normalizeDigits(phone);
        return digits ? `https://wa.me/${digits}` : null;
    }

    function telegramUrl(phone) {
        const digits = normalizeDigits(phone);
        return digits ? `https://t.me/+${digits}` : null;
    }

    function renderMessagingLinksHtml(phone, options) {
        options = options || {};
        const display = String(phone || '').trim();
        if (!display) {
            return '';
        }

        const wa = whatsAppUrl(display);
        const tg = telegramUrl(display);
        if (!wa || !tg) {
            return '';
        }

        const stop = options.stopPropagation !== false
            ? 'onclick="event.stopPropagation()"'
            : '';
        const className = options.className || 'contact-links';

        return `<div class="${className}" ${stop}>
            <a class="contact-link contact-whatsapp" href="${wa}" target="_blank" rel="noopener noreferrer" title="WhatsApp" ${stop}>
                <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
            <a class="contact-link contact-telegram" href="${tg}" target="_blank" rel="noopener noreferrer" title="Telegram" ${stop}>
                <i class="fab fa-telegram"></i> Telegram
            </a>
        </div>`;
    }

    return {
        normalizeDigits,
        whatsAppUrl,
        telegramUrl,
        renderMessagingLinksHtml
    };
})();
