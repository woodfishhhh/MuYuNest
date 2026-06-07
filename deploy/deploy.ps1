param(
  [string]$Remote = $env:DEPLOY_REMOTE,
  [string]$RemoteDir = $env:DEPLOY_DIR,
  [string]$Container = $env:DEPLOY_CONTAINER,
  [string]$BasePath = $env:VITE_BASE_PATH,
  [string]$SiteUrl = $env:DEPLOY_SITE_URL,
  [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Remote)) {
  $Remote = "root@36.151.148.198"
}

if ([string]::IsNullOrWhiteSpace($RemoteDir)) {
  $RemoteDir = "/opt/blog-stack/sites/newBlog"
}

if ([string]::IsNullOrWhiteSpace($Container)) {
  $Container = "blog-nginx"
}

if ([string]::IsNullOrWhiteSpace($BasePath)) {
  $BasePath = "/newBlog/"
}

if (-not $BasePath.StartsWith("/")) {
  $BasePath = "/$BasePath"
}

if (-not $BasePath.EndsWith("/")) {
  $BasePath = "$BasePath/"
}

if ([string]::IsNullOrWhiteSpace($SiteUrl)) {
  $SiteUrl = "https://woodfish.site$BasePath"
}

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = if ([string]::IsNullOrWhiteSpace($env:DEPLOY_DIST_DIR)) {
  Join-Path $projectRoot "apps/blog/dist"
} else {
  if ([System.IO.Path]::IsPathRooted($env:DEPLOY_DIST_DIR)) {
    $env:DEPLOY_DIST_DIR
  } else {
    Join-Path $projectRoot $env:DEPLOY_DIST_DIR
  }
}
$deployId = Get-Date -Format "yyyyMMddHHmmss"
$archive = Join-Path $env:TEMP "woodfishnest-$deployId.tar.gz"
$remoteScriptPath = Join-Path $env:TEMP "woodfishnest-activate-$deployId.sh"
$remoteArchive = "/tmp/woodfishnest-$deployId.tar.gz"
$remoteNginxConf = "/tmp/woodfishnest-nginx-$deployId.conf"
$remoteActivateScript = "/tmp/woodfishnest-activate-$deployId.sh"
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
  if (-not $SkipBuild) {
    Write-Host "==> 1. Build deploy artifact..."
    $previousBasePath = $env:VITE_BASE_PATH
    try {
      $env:VITE_BASE_PATH = $BasePath
      Invoke-CheckedNative pnpm build:deploy
    } finally {
      $env:VITE_BASE_PATH = $previousBasePath
    }
  } else {
    Write-Host "==> 1. Skip build; use existing deploy artifact..."
    Invoke-CheckedNative pnpm --filter "./apps/blog" exec tsx "../../packages/content-tools/src/cli.ts" verify-dist --dist-dir "apps/blog/dist" --base-path $BasePath
  }

  Write-Host "==> 2. Package $distDir ..."
  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
  Invoke-CheckedNative tar -C $distDir -czf $archive .

  Write-Host "==> 3. Upload archive and nginx config..."
  Invoke-CheckedNative scp @sshOptions $archive "${Remote}:$remoteArchive"
  Invoke-CheckedNative scp @sshOptions "deploy/nginx.conf" "${Remote}:$remoteNginxConf"

  Write-Host "==> 4. Activate release atomically..."
  $remoteEnv = @(
    "REMOTE_DIR=$(ConvertTo-BashSingleQuoted $RemoteDir)",
    "REMOTE_ARCHIVE=$(ConvertTo-BashSingleQuoted $remoteArchive)",
    "REMOTE_NGINX_CONF=$(ConvertTo-BashSingleQuoted $remoteNginxConf)",
    "BASE_PATH=$(ConvertTo-BashSingleQuoted $BasePath)",
    "CONTAINER=$(ConvertTo-BashSingleQuoted $Container)"
  ) -join " "

  $remoteScript = @'
set -euo pipefail

case "$REMOTE_DIR" in
  /opt/blog-stack/sites/*) ;;
  *) echo "Refusing unsafe deploy dir: $REMOTE_DIR" >&2; exit 2 ;;
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
if grep -q '"/assets/' "$release_dir/index.html"; then
  echo "index.html contains root-scoped /assets refs" >&2
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

if ! docker exec "$CONTAINER" sh -c "test -f /usr/share/nginx/html${BASE_PATH}index.html && grep -q '${BASE_PATH}assets/' /usr/share/nginx/html${BASE_PATH}index.html"; then
  rollback
  rm -f "$REMOTE_ARCHIVE" "$REMOTE_NGINX_CONF"
  exit 6
fi

rm -f "$REMOTE_ARCHIVE"
rm -f "$REMOTE_NGINX_CONF"
rm -f "$config_backup"
rm -rf "$backup_dir"
'@

  [System.IO.File]::WriteAllText($remoteScriptPath, $remoteScript, [System.Text.UTF8Encoding]::new($false))
  Invoke-CheckedNative scp @sshOptions $remoteScriptPath "${Remote}:$remoteActivateScript"
  Invoke-CheckedNative ssh @sshOptions $Remote "chmod 700 $(ConvertTo-BashSingleQuoted $remoteActivateScript)"
  Invoke-CheckedNative ssh @sshOptions $Remote "$remoteEnv bash $(ConvertTo-BashSingleQuoted $remoteActivateScript)"
  if ($LASTEXITCODE -ne 0) {
    throw "remote activate failed with exit code $LASTEXITCODE"
  }
  Invoke-CheckedNative ssh @sshOptions $Remote "rm -f $(ConvertTo-BashSingleQuoted $remoteActivateScript)"

  Write-Host "==> 5. Smoke live site..."
  $html = Invoke-WebRequest -Uri $SiteUrl -UseBasicParsing -TimeoutSec 30
  if ($html.Content -notmatch [regex]::Escape("${BasePath}assets/")) {
    throw "live HTML does not contain ${BasePath}assets/"
  }
  if ($html.Content -match '"/assets/') {
    throw 'live HTML still contains root-scoped /assets refs'
  }

  Write-Host "==> Deploy complete: $SiteUrl"
} finally {
  Pop-Location
  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
  if (Test-Path -LiteralPath $remoteScriptPath) {
    Remove-Item -LiteralPath $remoteScriptPath -Force
  }
}
