#!/usr/bin/env bash

set -euo pipefail

REMOTE="${DEPLOY_REMOTE:-root@36.151.148.198}"
SERVICE_DIR="${DEPLOY_VISITOR_COUNTER_DIR:-/opt/blog-stack/services/visitor-counter}"
UNIT_PATH="${DEPLOY_VISITOR_COUNTER_UNIT_PATH:-/etc/systemd/system/visitor-counter.service}"
NGINX_CONF_DIR="${DEPLOY_NGINX_CONF_DIR:-/opt/blog-stack/nginx/conf.d}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)

cd "$(dirname "$0")/.."

deploy_id="$(date +%Y%m%d%H%M%S)"
remote_script="/tmp/visitor-counter-$deploy_id.py"
remote_unit="/tmp/visitor-counter-$deploy_id.service"
remote_dashboard="/tmp/analytics-dashboard-$deploy_id"

echo "==> 1. Upload visitor counter service artifacts..."
scp "${SSH_OPTS[@]}" server/visitor-counter.py "$REMOTE:$remote_script"
scp "${SSH_OPTS[@]}" deploy/visitor-counter.service "$REMOTE:$remote_unit"
scp "${SSH_OPTS[@]}" -r server/analytics-dashboard "$REMOTE:$remote_dashboard"

echo "==> 2. Install / restart visitor counter service..."
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "SERVICE_DIR='$SERVICE_DIR' UNIT_PATH='$UNIT_PATH' NGINX_CONF_DIR='$NGINX_CONF_DIR' REMOTE_SCRIPT='$remote_script' REMOTE_UNIT='$remote_unit' REMOTE_DASHBOARD='$remote_dashboard' bash -se" <<'REMOTE_SCRIPT'
set -euo pipefail

case "$SERVICE_DIR" in
  /opt/blog-stack/services/*) ;;
  *) echo "Refusing unsafe service dir: $SERVICE_DIR" >&2; exit 2 ;;
esac

case "$UNIT_PATH" in
  /etc/systemd/system/*) ;;
  *) echo "Refusing unsafe unit path: $UNIT_PATH" >&2; exit 3 ;;
esac

case "$NGINX_CONF_DIR" in
  /opt/blog-stack/nginx/conf.d) ;;
  *) echo "Refusing unsafe nginx config dir: $NGINX_CONF_DIR" >&2; exit 4 ;;
esac

mkdir -p "$SERVICE_DIR" "$SERVICE_DIR/data" "$SERVICE_DIR/dashboard" /etc/woodfish /root/.config/woodfish
install -m 0644 "$REMOTE_SCRIPT" "$SERVICE_DIR/visitor-counter.py"
install -m 0644 "$REMOTE_UNIT" "$UNIT_PATH"
find "$SERVICE_DIR/dashboard" -mindepth 1 -maxdepth 1 -type f -delete
find "$REMOTE_DASHBOARD" -maxdepth 1 -type f -exec install -m 0644 {} "$SERVICE_DIR/dashboard/" \;

if [ ! -s /etc/woodfish/analytics-secret ]; then
  umask 077
  openssl rand -hex 32 > /etc/woodfish/analytics-secret
fi
chmod 0600 /etc/woodfish/analytics-secret

credentials_file=/root/.config/woodfish/analytics-admin.env
auth_file="$NGINX_CONF_DIR/analytics.htpasswd"
if [ ! -s "$credentials_file" ]; then
  analytics_password="$(openssl rand -hex 16)"
  umask 077
  printf 'ANALYTICS_USERNAME=woodfish\nANALYTICS_PASSWORD=%s\n' "$analytics_password" > "$credentials_file"
fi
# shellcheck disable=SC1090
source "$credentials_file"
printf 'woodfish:%s\n' "$(openssl passwd -apr1 "$ANALYTICS_PASSWORD")" > "$auth_file"
chmod 0640 "$auth_file"

systemctl daemon-reload
systemctl enable --now visitor-counter
systemctl restart visitor-counter

python3 - <<'PY'
import time
import urllib.request

for attempt in range(20):
    try:
        for path in ("/api/visitor-count", "/api/analytics/health"):
            payload = urllib.request.urlopen(f"http://127.0.0.1:3011{path}", timeout=2).read()
            print(payload.decode("utf-8"))
        break
    except OSError:
        if attempt == 19:
            raise
        time.sleep(0.5)
PY

rm -f "$REMOTE_SCRIPT" "$REMOTE_UNIT"
rm -rf "$REMOTE_DASHBOARD"
echo "Analytics dashboard credentials: $credentials_file"
REMOTE_SCRIPT

echo "==> Visitor counter service installed on $REMOTE"
