#!/usr/bin/env bash

set -Eeuo pipefail
umask 022

readonly RELEASE_ID="${1:-}"
readonly DIST_DIR="${2:-apps/blog/dist}"
readonly ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! "$RELEASE_ID" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'A 40-character lowercase Git SHA is required.\n' >&2
  exit 2
fi

cd "$ROOT_DIR"

if [[ ! -f "$DIST_DIR/index.html" \
  || ! -f "$DIST_DIR/sw.js" \
  || ! -f "$DIST_DIR/manifest.webmanifest" \
  || ! -d "$DIST_DIR/assets" ]]; then
  printf 'A complete static production build is required at %s.\n' "$DIST_DIR" >&2
  exit 2
fi

unexpected_env="$(find "$DIST_DIR" -name '.env*' -print -quit)"
if [[ -n "$unexpected_env" ]]; then
  printf 'Release payload contains a forbidden environment file: %s\n' "$unexpected_env" >&2
  exit 1
fi

while IFS= read -r -d '' link_path; do
  resolved_path="$(readlink -f "$link_path" 2>/dev/null || true)"
  case "$resolved_path" in
    "$ROOT_DIR/$DIST_DIR"/*) ;;
    *)
      printf 'Release contains an external or broken symlink: %s -> %s\n' \
        "$link_path" "$resolved_path" >&2
      exit 1
      ;;
  esac
done < <(find "$DIST_DIR" -type l -print0)

printf '%s\n' "$RELEASE_ID" >"$DIST_DIR/REVISION"

manifest_file="$(mktemp "${RUNNER_TEMP:-/tmp}/woodfish-release-manifest.XXXXXX")"
cleanup() {
  rm -f -- "$manifest_file"
}
trap cleanup EXIT

(
  cd "$DIST_DIR"
  find . -type f ! -name release.manifest.sha256 -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 --no-run-if-empty sha256sum \
    >"$manifest_file"
  mv "$manifest_file" release.manifest.sha256
  sha256sum --strict --check --quiet release.manifest.sha256
)

printf 'Static release %s assembled at %s.\n' "$RELEASE_ID" "$DIST_DIR"
