const crypto = require('crypto');

const TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_HOURS = 1;

function hashResetToken(rawToken) {
    return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

function generateResetToken() {
    return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

function getResetExpiryDate(hours = DEFAULT_EXPIRY_HOURS) {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function validateNewPassword(password) {
    const value = String(password || '');
    if (value.length < 6) {
        return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres' };
    }
    return { ok: true };
}

function getAppBaseUrl(req) {
    const configured = String(process.env.APP_BASE_URL || '').trim().replace(/\/$/, '');
    if (configured) {
        return configured;
    }
    const vercelUrl = String(process.env.VERCEL_URL || '').trim();
    if (vercelUrl) {
        return `https://${vercelUrl.replace(/^https?:\/\//, '')}`;
    }
    if (req && req.get && req.get('origin')) {
        return String(req.get('origin')).replace(/\/$/, '');
    }
    return 'http://localhost:3000';
}

function buildResetUrl(baseUrl, rawToken) {
    const origin = String(baseUrl || '').replace(/\/$/, '');
    const encoded = encodeURIComponent(rawToken);
    return `${origin}/reset-password.html?token=${encoded}`;
}

function buildResetEmailHtml(resetUrl, username) {
    const safeName = String(username || 'usuario')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `
<!DOCTYPE html>
<html lang="es">
<body style="font-family:Inter,Arial,sans-serif;background:#131722;color:#fff;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#1f2430;border-radius:12px;padding:28px;">
    <h1 style="color:#ff6b6b;margin:0 0 12px;font-size:22px;">Recuperar contraseña</h1>
    <p>Hola <strong>${safeName}</strong>,</p>
    <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Deseo Libre.</p>
    <p style="margin:24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#ff6b6b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
        Restablecer contraseña
      </a>
    </p>
    <p style="color:#aaa;font-size:14px;">Este enlace expira en 1 hora. Si no solicitaste este cambio, ignora este correo.</p>
    <p style="color:#888;font-size:12px;word-break:break-all;">${resetUrl}</p>
  </div>
</body>
</html>`;
}

function getMailFromAddress() {
    return process.env.MAIL_FROM
        || process.env.RESEND_FROM
        || 'Deseo Libre <onboarding@resend.dev>';
}

function isResendConfigured() {
    const key = String(process.env.RESEND_API_KEY || '').trim();
    return Boolean(key) && !/^re_x+$/i.test(key) && key.length >= 20;
}

async function sendPasswordResetEmail({ to, resetUrl, username }) {
    if (!isResendConfigured()) {
        throw new Error('RESEND_API_KEY no configurada');
    }
    const apiKey = process.env.RESEND_API_KEY;

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: getMailFromAddress(),
            to: [to],
            subject: 'Recuperar contraseña — Deseo Libre',
            html: buildResetEmailHtml(resetUrl, username)
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = data.message || data.error || `HTTP ${response.status}`;
        throw new Error(`No se pudo enviar el email: ${detail}`);
    }

    return data;
}

function isResetTokenExpired(expiresAt) {
    if (!expiresAt) {
        return true;
    }
    return new Date(expiresAt).getTime() <= Date.now();
}

module.exports = {
    TOKEN_BYTES,
    DEFAULT_EXPIRY_HOURS,
    hashResetToken,
    generateResetToken,
    getResetExpiryDate,
    isValidEmail,
    validateNewPassword,
    getAppBaseUrl,
    buildResetUrl,
    buildResetEmailHtml,
    getMailFromAddress,
    isResendConfigured,
    sendPasswordResetEmail,
    isResetTokenExpired
};
