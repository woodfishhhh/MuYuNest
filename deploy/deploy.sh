#!/usr/bin/env bash
# deploy.sh - 部署 WoodFishNest 到京东云 VPS
# 用法: bash deploy/deploy.sh

set -euo pipefail

REMOTE="${DEPLOY_REMOTE:-root@36.151.148.198}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/blog-stack/sites/newBlog}"
CONTAINER="${DEPLOY_CONTAINER:-blog-nginx}"
BASE_PATH="${VITE_BASE_PATH:-/}"
MOUNT_PATH="${DEPLOY_MOUNT_PATH:-/newBlog/}"
SITE_URL="${DEPLOY_SITE_URL:-https://blog.woodfish.site/}"
APP_ROOT="${DEPLOY_APP_ROOT:-apps/blog}"
DIST_DIR="${DEPLOY_DIST_DIR:-$APP_ROOT/dist}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new)

archive=""
cleanup() {
  if [ -n "$archive" ] && [ -f "$archive" ]; then
    rm -f "$archive"
  fi
}
trap cleanup EXIT

echo "==> 1. 构建项目..."
cd "$(dirname "$0")/.."
VITE_BASE_PATH="$BASE_PATH" pnpm build:deploy

archive="$(mktemp -t woodfishnest.XXXXXX.tar.gz)"
deploy_id="$(date +%Y%m%d%H%M%S)"
remote_archive="/tmp/woodfishnest-$deploy_id.tar.gz"
remote_nginx_conf="/tmp/woodfishnest-nginx-$deploy_id.conf"

echo "==> 2. 打包 $DIST_DIR ..."
tar -C "$DIST_DIR" -czf "$archive" .

echo "==> 3. 上传到 VPS..."
scp "${SSH_OPTS[@]}" "$archive" "$REMOTE:$remote_archive"
scp "${SSH_OPTS[@]}" deploy/nginx.conf "$REMOTE:$remote_nginx_conf"

echo "==> 4. 原子发布..."
ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "REMOTE_DIR='$REMOTE_DIR' REMOTE_ARCHIVE='$remote_archive' REMOTE_NGINX_CONF='$remote_nginx_conf' BASE_PATH='$BASE_PATH' MOUNT_PATH='$MOUNT_PATH' CONTAINER='$CONTAINER' bash -se" <<'REMOTE_SCRIPT'
set -euo pipefail

case "$REMOTE_DIR" in
  /opt/blog-stack/sites/*) ;;
  *) echo "拒绝发布到非站点目录: $REMOTE_DIR" >&2; exit 2 ;;
esac

parent_dir="$(dirname "$REMOTE_DIR")"
site_name="$(basename "$REMOTE_DIR")"
timestamp="$(date +%Y%m%d%H%M%S)"
release_dir="$parent_dir/.${site_name}.release.$timestamp"
backup_dir="$parent_dir/.${site_name}.backup.$timestamp"
config_path="/opt/blog-stack/nginx/conf.d/default.conf"
config_backup="${config_path}.bak.$timestamp"

rollback() {
  rm -rf "$REMOTE_DIR"
  if [ -d "$backup_dir" ]; then
    mv "$backup_dir" "$REMOTE_DIR"
  fi
  if [ -f "$config_backup" ]; then
    cat "$config_backup" > "$config_path"
    rm -f "$config_backup"
  fi
  docker exec "$CONTAINER" nginx -s reload >/dev/null 2>&1 || true
}

rm -rf "$release_dir"
mkdir -p "$release_dir"
tar -xzf "$REMOTE_ARCHIVE" -C "$release_dir"

test -f "$release_dir/index.html"
test -f "$release_dir/sw.js"
test -f "$release_dir/manifest.webmanifest"
test -d "$release_dir/assets"
grep -q "${BASE_PATH}assets/" "$release_dir/index.html"
if [ "$BASE_PATH" != "/" ] && grep -q '"/assets/' "$release_dir/index.html"; then
  echo "index.html 仍包含根路径 /assets，停止发布" >&2
  exit 3
fi

cp "$config_path" "$config_backup"
cat "$REMOTE_NGINX_CONF" > "$config_path"
if ! docker exec "$CONTAINER" nginx -t; then
  cat "$config_backup" > "$config_path"
  rm -f "$config_backup"
  rm -rf "$release_dir"
  rm -f "$REMOTE_ARCHIVE" "$REMOTE_NGINX_CONF"
  exit 4
fi

if [ -d "$REMOTE_DIR" ]; then
  mv "$REMOTE_DIR" "$backup_dir"
fi
mv "$release_dir" "$REMOTE_DIR"
chmod -R a+rX "$REMOTE_DIR"

if ! docker exec "$CONTAINER" nginx -s reload; then
  rollback
  rm -f "$REMOTE_ARCHIVE" "$REMOTE_NGINX_CONF"
  exit 5
fi

if ! docker exec "$CONTAINER" sh -c "test -f /usr/share/nginx/html${MOUNT_PATH}index.html && grep -q '${BASE_PATH}assets/' /usr/share/nginx/html${MOUNT_PATH}index.html"; then
  rollback
  rm -f "$REMOTE_ARCHIVE" "$REMOTE_NGINX_CONF"
  exit 6
fi

rm -f "$REMOTE_ARCHIVE"
rm -f "$REMOTE_NGINX_CONF"
rm -f "$config_backup"
rm -rf "$backup_dir"
REMOTE_SCRIPT

echo "==> 5. 线上验证..."
html="$(curl -kfsSL "$SITE_URL")"
printf '%s' "$html" | grep -q "${BASE_PATH}assets/"
if [ "$BASE_PATH" != "/" ] && printf '%s' "$html" | grep -q '"/assets/'; then
  echo "线上 HTML 仍包含根路径 /assets" >&2
  exit 4
fi

echo "==> 部署完成! $SITE_URL"
