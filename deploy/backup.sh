#!/bin/bash
# Daily backup of database, media and config. Installed as /etc/cron.daily/deseolibre-backup.
set -euo pipefail

APP_DIR=/opt/deseolibre/app
MEDIA_DIR=/opt/deseolibre/media
BACKUP_DIR=/var/backups/deseolibre
DB_KEEP_DAYS=30
MEDIA_KEEP_DAYS=7
STAMP=$(date +%Y%m%d-%H%M)

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

cd "$APP_DIR"
sudo -u deseolibre node deploy/backup-db.js | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz.tmp"
mv "$BACKUP_DIR/db-$STAMP.sql.gz.tmp" "$BACKUP_DIR/db-$STAMP.sql.gz"

tar -czf "$BACKUP_DIR/media-$STAMP.tar.gz" -C "$(dirname "$MEDIA_DIR")" "$(basename "$MEDIA_DIR")"
cp "$APP_DIR/.env.local" "$BACKUP_DIR/env-$STAMP.local"
chmod 600 "$BACKUP_DIR"/*

find "$BACKUP_DIR" -name 'db-*.sql.gz' -mtime +"$DB_KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'env-*.local' -mtime +"$DB_KEEP_DAYS" -delete
find "$BACKUP_DIR" -name 'media-*.tar.gz' -mtime +"$MEDIA_KEEP_DAYS" -delete

echo "backup ok $STAMP"
