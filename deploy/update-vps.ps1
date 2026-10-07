# Publica el último commit en el VPS (ejecutar desde la raíz del repo en Windows).
param(
    [string]$HostName = '15.235.63.74',
    [string]$KeyPath = "$env:USERPROFILE\.ssh\deseolibre_vps"
)
$ErrorActionPreference = 'Stop'
$archive = Join-Path $env:TEMP 'deseolibre-app.tar.gz'
git archive --format=tar.gz -o $archive HEAD
scp -i $KeyPath -o BatchMode=yes $archive "ubuntu@${HostName}:/tmp/app.tar.gz"
$remote = @'
set -e
cd /opt/deseolibre
rm -rf app.new
mkdir app.new
tar -xzf /tmp/app.tar.gz -C app.new
cp -p app/.env.local app.new/.env.local
chown -R deseolibre:deseolibre app.new
cd app.new && sudo -u deseolibre HOME=/opt/deseolibre npm ci --omit=dev --no-audit --no-fund --loglevel=error
cd /opt/deseolibre
rm -rf app.old
mv app app.old
mv app.new app
systemctl restart deseolibre
sleep 10
systemctl is-active deseolibre
curl -s -o /dev/null -w "health %{http_code}\n" http://127.0.0.1:3000/api/health
'@
$remote = $remote -replace "`r`n", "`n"
$remote | ssh -i $KeyPath -o BatchMode=yes "ubuntu@$HostName" "sudo bash -s"
