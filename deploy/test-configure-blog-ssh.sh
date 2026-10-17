#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
export SSH_DIR="$test_dir/ssh"
export SSH_HOST='deploy.example.test'
export SSH_PRIVATE_KEY=$'test-only-key\nwith-two-lines'
bash "$script_dir/configure-blog-ssh.sh"

test "$(cat "$SSH_DIR/id_rsa")" = "$SSH_PRIVATE_KEY"
test "$(stat -c %a "$SSH_DIR/id_rsa")" = 600
ssh-keygen -F "$SSH_HOST" -f "$SSH_DIR/known_hosts" > "$test_dir/host-key"
grep -Fq "$(cat "$script_dir/blog-host-key.pub")" "$test_dir/host-key"
ssh -G -F "$SSH_DIR/config" "$SSH_HOST" > "$test_dir/effective-config"
grep -qx 'stricthostkeychecking true' "$test_dir/effective-config"
grep -qx 'identitiesonly yes' "$test_dir/effective-config"
grep -qx 'batchmode yes' "$test_dir/effective-config"
grep -qx 'connectionattempts 1' "$test_dir/effective-config"

if SSH_HOST='' bash "$script_dir/configure-blog-ssh.sh" 2>/dev/null; then
  echo 'Missing host was accepted' >&2; exit 1
fi
if SSH_PRIVATE_KEY='' bash "$script_dir/configure-blog-ssh.sh" 2>/dev/null; then
  echo 'Missing private key was accepted' >&2; exit 1
fi
if SSH_HOST=$'host\n  StrictHostKeyChecking no' bash "$script_dir/configure-blog-ssh.sh" 2>/dev/null; then
  echo 'Host configuration injection was accepted' >&2; exit 1
fi
echo 'SSH configuration checks passed'
