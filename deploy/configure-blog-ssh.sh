#!/usr/bin/env bash
set -euo pipefail

: "${SSH_HOST:?SSH_HOST is required}"
: "${SSH_PRIVATE_KEY:?SSH_PRIVATE_KEY is required}"
if [[ ! "$SSH_HOST" =~ ^[a-zA-Z0-9._:-]+$ ]]; then
  echo 'SSH_HOST must be a hostname or IP address, without a user or port suffix' >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ssh_dir="${SSH_DIR:-$HOME/.ssh}"
# This public key was verified through an existing trusted SSH connection.
# Do not probe with ssh-keyscan: its parallel pre-auth connections trigger
# the server's per-source limit and Fail2ban before deployment can start.
ssh-keygen -lf "$script_dir/blog-host-key.pub" >/dev/null
umask 077
install -m 700 -d "$ssh_dir"
printf '%s\n' "$SSH_PRIVATE_KEY" > "$ssh_dir/id_rsa"
printf '%s %s\n' "$SSH_HOST" "$(cat "$script_dir/blog-host-key.pub")" > "$ssh_dir/known_hosts"
cat > "$ssh_dir/config" <<EOF
Host $SSH_HOST
  IdentityFile "$ssh_dir/id_rsa"
  IdentitiesOnly yes
  UserKnownHostsFile "$ssh_dir/known_hosts"
  StrictHostKeyChecking yes
  BatchMode yes
  ConnectTimeout 20
  ConnectionAttempts 1
  ServerAliveInterval 15
  ServerAliveCountMax 4
EOF
chmod 600 "$ssh_dir/id_rsa" "$ssh_dir/known_hosts" "$ssh_dir/config"
