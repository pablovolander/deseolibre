#!/usr/bin/env bash
# Instalación inicial en un VPS Ubuntu 24.04 (ejecutar como root).
# Uso: bash setup-vps.sh DOMINIO
set -euo pipefail

DOMAIN="${1:?Falta el dominio, ej: bash setup-vps.sh deseolibre.com}"
APP_DIR=/opt/deseolibre/app
MEDIA_DIR=/opt/deseolibre/media

apt-get update
apt-get install -y curl git nginx certbot python3-certbot-nginx ufw

if ! command -v node >/dev/null || ! node -v | grep -q '^v22'; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

id deseolibre >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/deseolibre --shell /usr/sbin/nologin deseolibre
mkdir -p "$APP_DIR" "$MEDIA_DIR"
chown -R deseolibre:deseolibre /opt/deseolibre
chmod 750 "$MEDIA_DIR"

cd "$APP_DIR"
sudo -u deseolibre npm ci --omit=dev

if [ ! -f "$APP_DIR/.env.local" ]; then
    echo "Falta $APP_DIR/.env.local (ver .env.example, sección VPS)." >&2
    exit 1
fi
chown deseolibre:deseolibre "$APP_DIR/.env.local"
chmod 600 "$APP_DIR/.env.local"

cp "$APP_DIR/deploy/deseolibre.service" /etc/systemd/system/deseolibre.service
systemctl daemon-reload
systemctl enable --now deseolibre

sed "s/DOMINIO/$DOMAIN/g" "$APP_DIR/deploy/nginx-deseolibre.conf" > /etc/nginx/sites-available/deseolibre
ln -sf /etc/nginx/sites-available/deseolibre /etc/nginx/sites-enabled/deseolibre
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect

echo "Listo: https://$DOMAIN"
