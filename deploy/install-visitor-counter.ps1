param(
  [string]$Remote = $env:DEPLOY_REMOTE,
  [string]$ServiceDir = $env:DEPLOY_VISITOR_COUNTER_DIR,
  [string]$UnitPath = $env:DEPLOY_VISITOR_COUNTER_UNIT_PATH,
  [string]$NginxConfDir = $env:DEPLOY_NGINX_CONF_DIR
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Remote)) {
  $Remote = "root@36.151.148.198"
}

if ([string]::IsNullOrWhiteSpace($ServiceDir)) {
  $ServiceDir = "/opt/blog-stack/services/visitor-counter"
}

if ([string]::IsNullOrWhiteSpace($UnitPath)) {
  $UnitPath = "/etc/systemd/system/visitor-counter.service"
}

if ([string]::IsNullOrWhiteSpace($NginxConfDir)) {
  $NginxConfDir = "/opt/blog-stack/nginx/conf.d"
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$deployId = Get-Date -Format "yyyyMMddHHmmss"
$remoteScript = "/tmp/visitor-counter-$deployId.py"
$remoteUnit = "/tmp/visitor-counter-$deployId.service"
$remoteDashboard = "/tmp/analytics-dashboard-$deployId"
$sshOptions = @("-o", "StrictHostKeyChecking=accept-new")

function Invoke-CheckedNative {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath failed with exit code $LASTEXITCODE"
  }
}

function ConvertTo-BashSingleQuoted {
  param([Parameter(Mandatory = $true)][string]$Value)
  return "'" + $Value.Replace("'", "'\''") + "'"
}

Push-Location $projectRoot
try {
  Write-Host "==> 1. Upload visitor counter service artifacts..."
  Invoke-CheckedNative scp @sshOptions "server/visitor-counter.py" "${Remote}:$remoteScript"
  Invoke-CheckedNative scp @sshOptions "deploy/visitor-counter.service" "${Remote}:$remoteUnit"
  Invoke-CheckedNative scp @sshOptions "-r" "server/analytics-dashboard" "${Remote}:$remoteDashboard"

  Write-Host "==> 2. Install / restart visitor counter service..."
  $remoteEnv = @(
    "SERVICE_DIR=$(ConvertTo-BashSingleQuoted $ServiceDir)",
    "UNIT_PATH=$(ConvertTo-BashSingleQuoted $UnitPath)",
    "NGINX_CONF_DIR=$(ConvertTo-BashSingleQuoted $NginxConfDir)",
    "REMOTE_SCRIPT=$(ConvertTo-BashSingleQuoted $remoteScript)",
    "REMOTE_UNIT=$(ConvertTo-BashSingleQuoted $remoteUnit)",
    "REMOTE_DASHBOARD=$(ConvertTo-BashSingleQuoted $remoteDashboard)"
  ) -join " "

  $remoteScriptBody = @'
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
'@

  $remoteScriptBody | & ssh @sshOptions $Remote "$remoteEnv bash -se"
  if ($LASTEXITCODE -ne 0) {
    throw "remote install failed with exit code $LASTEXITCODE"
  }

  Write-Host "==> Visitor counter service installed on $Remote"
} finally {
  Pop-Location
}
