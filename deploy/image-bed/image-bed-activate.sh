#!/usr/bin/env bash
set -Eeuo pipefail
umask 022

incoming=/opt/blog-stack/deploy-incoming/image-bed
state=/opt/blog-stack/.image-bed-activate
live=/opt/blog-stack/sites/admin
exchange=/usr/local/sbin/image-bed-exchange
registry=ghcr.io/woodfishhhh/muyu-image-bed-api
rollback=muyu-image-bed-api:rollback
container=muyu-image-bed-api
compose=(docker compose -p image-bed -f /opt/muyu-image-bed/deploy/image-bed/docker-compose.prod.yml)
origin=https://img.woodfish.site
work=$(mktemp -d "$state/activate.XXXXXXXX")
release=''
result=failed
rollback_api=no
rollback_web=''

http() { curl -fsS --max-time 3 --resolve img.woodfish.site:443:127.0.0.1 "$origin$1"; }
healthy() {
  local sha=$1
  for _ in {1..30}; do
    if http /api/health | jq -e --arg sha "$sha" '.db == "ok" and .service == "ok" and ($sha == "" or .revision == $sha)' >/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}
start_api() { MUYU_API_IMAGE=$1 "${compose[@]}" up -d --pull never --no-deps image-bed-api; }
publish() {
  printf '%s %s\n' "$release" "$1" > "$work/status" && mv -fT -- "$work/status" "$live/DEPLOY_STATUS"
}
finish() {
  local code=$?
  set +e
  if (( code != 0 )) && [[ -n $release ]]; then
    if [[ -n $rollback_web ]] && ! "$exchange" "$live" "$rollback_web"; then
      result=rollback-failed
    fi
    if [[ $rollback_api == yes ]]; then
      if start_api "$rollback" && healthy ''; then
        [[ $result == rollback-failed ]] || result=rolled-back
      else
        result=rollback-failed
      fi
    fi
    publish "$result" || echo 'Could not publish activation status' >&2
  fi
  echo "Image-bed activation ${release:-unknown}: $result"
  if [[ $result == rollback-failed ]]; then
    echo "Rollback recovery files retained at $work" >&2
  else
    rm -rf --one-file-system -- "$work"
  fi
  exit "$code"
}
trap finish EXIT

[[ -d $live && ! -L $live ]]
mv -T -- "$incoming/READY" "$work/READY"
[[ -f $work/READY && ! -L $work/READY && $(stat -c %h "$work/READY") == 1 ]]
marker=$(head -c 128 "$work/READY")
[[ $marker =~ ^([0-9a-f]{40})\ ([0-9]{1,20}\.[0-9]{1,10})$ ]]
sha=${BASH_REMATCH[1]}
release=$marker
image=$registry:$sha

# The sender runs as the restricted user; only the receiver writes as root.
rsync -rltp --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
  -e 'sh -c '\''shift; exec runuser -u imgbed-deploy -- "$@"'\'' sh' \
  "local:$incoming/web" "$work/"
web=$work/web
[[ -d $web/assets && -f $web/index.html && -f $web/REVISION && -f $web/release.manifest.sha256 ]]
[[ -z $(find "$web" ! -type d ! -type f -print -quit) && ! -e $web/DEPLOY_STATUS ]]
[[ $(cat "$web/REVISION") == "$sha" ]]
grep -Fq '<title>Muyu Admin</title>' "$web/index.html"
grep -Fq '/admin/assets/' "$web/index.html"
# Regenerate the list instead of opening paths from an untrusted manifest.
(cd "$web" && find . -type f ! -path ./release.manifest.sha256 -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) > "$work/manifest"
cmp "$work/manifest" "$web/release.manifest.sha256"

# Keep one generation of hashed assets for pages opened just before the exchange.
if [[ -f $live/release.manifest.sha256 ]]; then
  sed -nE 's/^[0-9a-f]{64}  \.\/(assets\/[-A-Za-z0-9_./]+)$/\1/p' "$live/release.manifest.sha256" > "$work/previous-assets"
  rsync -rpt --ignore-existing --files-from="$work/previous-assets" "$live/" "$web/"
elif [[ -d $live/assets && ! -L $live/assets ]]; then
  rsync -rpt --ignore-existing "$live/assets/" "$web/assets/"
fi

# Never use any pre-existing Docker credentials on the host.
mkdir "$work/docker"
printf '%s\n' '{"auths":{}}' > "$work/docker/config.json"
docker --config "$work/docker" pull "$image"
docker image inspect --format '{{json .Config.Env}}' "$image" |
  jq -e --arg revision "MUYU_RELEASE_SHA=$sha" 'index($revision) != null' >/dev/null
old_id=$(docker inspect --type container --format '{{.Image}}' "$container")
old_ref=$(docker inspect --type container --format '{{.Config.Image}}' "$container")
new_id=$(docker image inspect --format '{{.Id}}' "$image")
if [[ $old_ref != "$image" || $old_id != "$new_id" ]]; then
  docker image tag "$old_id" "$rollback"
  rollback_api=yes
  start_api "$image"
fi
[[ $(docker inspect --type container --format '{{.Image}}' "$container") == "$new_id" ]]
healthy "$sha"

if [[ ! -f $live/release.manifest.sha256 ]] || ! cmp -s "$work/manifest" "$live/release.manifest.sha256" ||
   ! (cd "$live" && sha256sum --strict --check --quiet release.manifest.sha256); then
  "$exchange" "$live" "$web"
  rollback_web=$web
fi
[[ $(http /admin/REVISION) == "$sha" ]]
grep -Fq '<title>Muyu Admin</title>' <<< "$(http /admin/)"
if [[ -n $rollback_web ]]; then
  if [[ -d $state/admin.prev ]]; then
    "$exchange" "$web" "$state/admin.prev"
  else
    mv -T -- "$web" "$state/admin.prev"
  fi
  rollback_web=$state/admin.prev
fi
publish ok
result=ok
