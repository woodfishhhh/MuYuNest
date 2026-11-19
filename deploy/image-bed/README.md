# Muyu Image Bed VPS Deploy

## Automated deploy host setup

Actions uploads only to `/opt/blog-stack/deploy-incoming/image-bed` over SSH
as `imgbed-deploy`. No CI credential can run a shell or Docker on the host.
The existing production Compose file, environment, data, and nginx routes stay
host-managed. The GHCR package must allow anonymous pulls.

Before enabling the units, keep a root-only copy of the nginx configuration,
production Compose file, and `/opt/blog-stack/sites/admin`. Record and tag
the running API's image ID, and take a SQLite online backup (`sqlite3 .backup`)
before deploying any change that includes migrations.

As root on the host (from this directory; account creation is one-time):

```bash
useradd --system --home-dir /var/lib/imgbed-deploy --shell /bin/sh --no-create-home imgbed-deploy
install -d -o root -g root -m 0755 /var/lib/imgbed-deploy/.ssh
install -d -o imgbed-deploy -g imgbed-deploy -m 0750 /opt/blog-stack/deploy-incoming/image-bed
install -d -o root -g root -m 0700 /opt/blog-stack/.image-bed-activate
install -m 0755 image-bed-activate.sh /usr/local/sbin/image-bed-activate
install -m 0755 image-bed-exchange.py /usr/local/sbin/image-bed-exchange
install -m 0644 image-bed-activate.{path,service} /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/image-bed-activate.{path,service}
systemctl daemon-reload
systemctl enable --now image-bed-activate.path
```

Generate a dedicated ed25519 key. Install its public key in
`/var/lib/imgbed-deploy/.ssh/authorized_keys` (root:root, mode 0644), prefixed
with `restrict,command="/usr/bin/rrsync -wo -munge /opt/blog-stack/deploy-incoming/image-bed"`
and a space. Put only the private key in `IMAGE_BED_DEPLOY_SSH_KEY` using
`gh secret set IMAGE_BED_DEPLOY_SSH_KEY --repo woodfishhhh/MuYuNest < keyfile`.
Keep the verified SSH host key in `deploy/blog-host-key.pub`.

The watcher consumes `READY` after upload, verifies the complete frontend
manifest, anonymously pulls the commit-tagged image before replacing the API,
and atomically exchanges the admin directory. The single API container can be
unavailable briefly during recreation; `/o/` continues serving files from
nginx. The host publishes `<commit> <run>.<attempt> <result>` at
`/admin/DEPLOY_STATUS`. Check `journalctl -u image-bed-activate` for failures.

For manual recovery, stop the path unit and let any in-flight activation finish.
Use `image-bed-exchange /opt/blog-stack/sites/admin /opt/blog-stack/.image-bed-activate/admin.prev`
to restore the previous frontend (use a copy of the initial backup if needed).
Recreate the API using its recorded previous tag (normally
`muyu-image-bed-api:rollback`):

```bash
MUYU_API_IMAGE=muyu-image-bed-api:rollback docker compose -p image-bed \
  -f /opt/muyu-image-bed/deploy/image-bed/docker-compose.prod.yml up -d --pull never --no-deps image-bed-api
curl -fsS https://img.woodfish.site/api/health
curl -fsS https://img.woodfish.site/admin/ > /dev/null
```

For code-only rollback, do not overwrite live SQLite data. Keep future schema
migrations compatible with the previous API; restoring a database snapshot is
a separate operation and could discard writes made after the backup.

## 1) DNS + TLS

1. Point `img.woodfish.site` A/AAAA record to VPS.
2. Verify DNS:
   - `nslookup img.woodfish.site`
   - `dig +short img.woodfish.site @1.1.1.1` (must return VPS public IP)
3. Issue cert with certbot and enable auto renew.
   - `sudo certbot certonly --webroot -w /opt/blog-stack/certbot/www -d img.woodfish.site`
   - `sudo ls -la /etc/letsencrypt/live/img.woodfish.site`
4. Confirm HTTP redirects to HTTPS.

Optional DNS API upsert (JDCloud AK/SK):

VP-series command surface (from repo root):

```bash
npx vp run image-bed:dns:upsert -- --ak ak_xxx --sk sk_xxx --domain woodfish.site --rr img --type A --value 36.151.148.198
npx vp run image-bed:dns:upsert:dry -- --ak ak_xxx --sk sk_xxx --domain woodfish.site --rr img --type A --value 36.151.148.198
```

Linux:

```bash
JDCLOUD_ACCESS_KEY_ID='ak_xxx' \
JDCLOUD_SECRET_ACCESS_KEY='sk_xxx' \
bash deploy/image-bed/jdcloud-dns-upsert.sh \
  --domain woodfish.site \
  --rr img \
  --type A \
  --value 36.151.148.198
```

Windows:

```powershell
$env:JDCLOUD_ACCESS_KEY_ID='ak_xxx'
$env:JDCLOUD_SECRET_ACCESS_KEY='sk_xxx'
powershell -ExecutionPolicy Bypass -File deploy/image-bed/jdcloud-dns-upsert.ps1 -- `
  --domain woodfish.site `
  --rr img `
  --type A `
  --value 36.151.148.198
```

Dry-run supported:

```bash
bash deploy/image-bed/jdcloud-dns-upsert.sh --value 36.151.148.198 --dry-run
```

One-shot full close with DNS API + TLS/public checks:

VP-series command surface (from repo root):

```bash
npx vp run image-bed:wave5:close:dns-api -- --ak ak_xxx --sk sk_xxx --probe-file ./test-unique.png
npx vp run image-bed:wave5:close:dns-api:win -- -AccessKeyId 'ak_xxx' -SecretAccessKey 'sk_xxx' -Token 'muyu_xxx' -ProbeFile '.\\test-unique.png'
npx vp run image-bed:section43:audit
npx vp run image-bed:section43:audit:win
```

Linux:

```bash
TOKEN='muyu_xxx' \
JDCLOUD_ACCESS_KEY_ID='ak_xxx' \
JDCLOUD_SECRET_ACCESS_KEY='sk_xxx' \
bash deploy/image-bed/close-wave5-with-dns-api.sh ./test-unique.png
```

Windows:

```powershell
$env:JDCLOUD_ACCESS_KEY_ID='ak_xxx'
$env:JDCLOUD_SECRET_ACCESS_KEY='sk_xxx'
powershell -ExecutionPolicy Bypass -File deploy/image-bed/close-wave5-with-dns-api.ps1 `
  -Token 'muyu_xxx' `
  -ProbeFile '.\test-unique.png'
```

Optional one-shot finalizer (after DNS points to VPS and propagates):

```bash
EXPECTED_IP=36.151.148.198 \
bash deploy/image-bed/finalize-dns-tls.sh
```

Optional auto-finalizer (systemd timer, retries every 5 min until DNS is ready):

```bash
sudo bash deploy/image-bed/install-dns-tls-finalizer.sh "$(pwd)"
sudo systemctl status --no-pager muyu-dns-tls-finalize.timer
sudo tail -n 80 /opt/muyu-image-bed/logs/dns-tls-finalize.log
```

Cutover status quick check:

```bash
EXPECTED_IP=36.151.148.198 \
bash deploy/image-bed/check-cutover-status.sh
```

Section 43 gate audit (plan shutdown gate):

```bash
bash deploy/image-bed/section43-audit.sh
powershell -ExecutionPolicy Bypass -File deploy/image-bed/section43-audit.ps1 -SkipRemote
```

One-click closer after DNS is ready:

```bash
TOKEN='muyu_xxx' \
bash deploy/image-bed/close-wave5-after-dns.sh ./test-unique.png
```

Windows (PowerShell) one-click closer:

```powershell
powershell -ExecutionPolicy Bypass -File deploy/image-bed/close-wave5-after-dns.ps1 `
  -Token 'muyu_xxx' `
  -ProbeFile '.\test-unique.png'
```

## 2) Host Directories

```bash
sudo mkdir -p /srv/muyu-images/{original,webp,thumbs}
sudo mkdir -p /srv/muyu-data /srv/muyu-admin /srv/muyu-backups /etc/muyu
sudo chown -R root:root /srv/muyu-admin /srv/muyu-backups
sudo chown -R 1000:1000 /srv/muyu-images /srv/muyu-data
sudo chmod -R 755 /srv/muyu-images /srv/muyu-admin
sudo chmod -R 750 /srv/muyu-data
```

## 3) API Env + Compose

1. Copy env file:
   - `sudo cp deploy/image-bed/image-bed-api.env.example /etc/muyu/image-bed-api.env`
2. Edit `/etc/muyu/image-bed-api.env` and set a strong `TOKEN_SECRET`.
3. Start service:
   - `docker compose -f deploy/image-bed/docker-compose.prod.yml up -d`
4. Validate:
   - `docker compose -f deploy/image-bed/docker-compose.prod.yml ps`
   - `docker compose -f deploy/image-bed/docker-compose.prod.yml logs -f image-bed-api`
   - `curl -fsSL http://127.0.0.1:3000/api/health`

## 4) Nginx

1. Copy config:
   - `sudo cp deploy/image-bed/img.woodfish.site.conf /etc/nginx/sites-available/img.woodfish.site.conf`
2. Link and test:
   - `sudo ln -s /etc/nginx/sites-available/img.woodfish.site.conf /etc/nginx/sites-enabled/img.woodfish.site.conf`
   - `sudo nginx -t`
   - `sudo systemctl reload nginx`
3. Validate:
   - `curl -fsSL https://img.woodfish.site/api/health`

## 5) Admin Bootstrap

```bash
npm run image-bed:api:create-admin
```

Store the printed token in a password manager.

## 6) Production Smoke

```bash
TOKEN='muyu_xxx' BASE_URL='https://img.woodfish.site' \
  bash deploy/image-bed/smoke-prod.sh ./test.png
```

Notes:

- Use a file that has not been uploaded before (current API behavior on same-hash re-upload may return `500`).
- Before public DNS/TLS cutover is finished, you can run pre-production smoke with host override:

```bash
TOKEN='muyu_xxx' BASE_URL='https://img.woodfish.site' \
CURL_ARGS='--resolve img.woodfish.site:443:127.0.0.1 -k' \
bash deploy/image-bed/smoke-prod.sh ./test-unique.png
```

## 7) Backup + Restore

Manual backup:

```bash
bash deploy/image-bed/backup-muyu.sh
```

Disk usage:

```bash
bash deploy/image-bed/check-disk-usage.sh
```

Restore notes:

1. Stop compose service.
2. Replace SQLite file from backup.
3. Restore image tarball under `/srv/muyu-images`.
4. Start compose service.
5. Run smoke script.

Dry-run restore verifier:

```bash
bash deploy/image-bed/restore-muyu-dry-run.sh /srv/muyu-backups/muyu-YYYY.sqlite /srv/muyu-backups/muyu-images-YYYY.tgz
```
