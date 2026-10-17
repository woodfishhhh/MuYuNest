# Deployment SSH host verification

The blog deployment and diagnostic workflow use `deploy/configure-blog-ssh.sh`.
`deploy/blog-host-key.pub` is the server's **public** Ed25519 host key, verified
through the operator's existing trusted `jdcloud-blog` SSH connection. The
private deployment key remains in the `SSH_PRIVATE_KEY` GitHub secret.

## Why the scanner was removed

Run `39052343387` failed before staging the release on 2026-10-17. Server logs
showed the runner's `ssh-keyscan` requests hitting `PerSourceMaxStartups=3`,
then four pre-authentication failures. Fail2ban (`maxretry=4`) banned that runner
at 17:09:18 UTC. All subsequent deployment attempts timed out. The previously
deployed revision remained intact.

The workflows now write the independently verified key directly into
`known_hosts` and require `StrictHostKeyChecking=yes`, `IdentitiesOnly=yes` and
batch mode. No network probing is needed. Each SSH attempt connects once;
the staging step retains its bounded backoff for transient transport failures.
Server firewall and Fail2ban policies remain unchanged. Diagnostics now fail
when SSH fails instead of hiding the error behind a successful echo.

## Host key rotation and recovery

If the server is rebuilt or its host key intentionally changes, verify the new
public key using a trusted console or an already authenticated connection,
update `deploy/blog-host-key.pub`, and rerun CI. Never disable strict host
checking or trust an unauthenticated scan to make deployment pass.

Run `bash deploy/test-configure-blog-ssh.sh` to verify key installation, private
file permissions, effective SSH policy, and rejected missing/invalid inputs.
The script uses an isolated temporary SSH directory and makes no network calls.
The existing atomic release activation and rollback remain unchanged.
