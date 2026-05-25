/**
 * Enlaces WhatsApp (teléfono) y Telegram (usuario @).
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

    function normalizeTelegramUsername(raw) {
        const username = String(raw || '').trim().replace(/^@+/, '');
        if (!username) {
            return { ok: false, error: 'Indica tu usuario de Telegram' };
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)) {
            return { ok: false, error: 'Usuario de Telegram inválido (5-32 caracteres, sin @)' };
        }
        return { ok: true, telegram_username: username };
    }

    function whatsAppUrl(phone) {
        const digits = normalizeDigits(phone);
        return digits ? `https://wa.me/${digits}` : null;
    }

    function telegramUrl(phone, telegramUsername) {
        const userCheck = normalizeTelegramUsername(telegramUsername);
        if (userCheck.ok) {
            return `https://t.me/${userCheck.telegram_username}`;
        }
        const digits = normalizeDigits(phone);
        return digits ? `https://t.me/+${digits}` : null;
    }

    function renderMessagingLinksHtml(contact, options) {
        options = options || {};
        const phone = typeof contact === 'string' ? contact : (contact?.phone || '');
        const telegramUsername = typeof contact === 'object' ? contact?.telegram_username : '';

        const wa = whatsAppUrl(phone);
        const tg = telegramUrl(phone, telegramUsername);
        if (!wa && !tg) {
            return '';
        }

        const stop = options.stopPropagation !== false
            ? 'onclick="event.stopPropagation()"'
            : '';
        const className = options.className || 'contact-links';
        const parts = [];

        if (wa) {
            parts.push(`<a class="contact-link contact-whatsapp" href="${wa}" target="_blank" rel="noopener noreferrer" title="WhatsApp" ${stop}>
                <i class="fab fa-whatsapp"></i> WhatsApp
            </a>`);
        }
        if (tg) {
            const tgLabel = userCheckLabel(telegramUsername);
            parts.push(`<a class="contact-link contact-telegram" href="${tg}" target="_blank" rel="noopener noreferrer" title="Telegram" ${stop}>
                <i class="fab fa-telegram"></i> Telegram${tgLabel}
            </a>`);
        }

        return `<div class="${className}" ${stop}>${parts.join('')}</div>`;
    }

    function userCheckLabel(telegramUsername) {
        const u = String(telegramUsername || '').trim().replace(/^@+/, '');
        return u ? ` @${u}` : '';
    }

    return {
        normalizeDigits,
        normalizeTelegramUsername,
        whatsAppUrl,
        telegramUrl,
        renderMessagingLinksHtml
    };
})();
