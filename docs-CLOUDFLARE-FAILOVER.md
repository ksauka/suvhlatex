# Cloudflare and two-machine failover

This setup keeps `suvhlatex` available at a stable Cloudflare hostname while
the desktop or laptop is running. It follows the active/standby model used by
the ETV_V2 deployment.

## Target layout

```text
https://latex.aitheoryelaboration.org
              |
       Cloudflare Tunnel: suvhlatex
              |
     desktop primary / laptop standby
              |
        http://127.0.0.1:8765
```

The hostname is a separate subdomain. It does not change the existing ETV
site at `aitheoryelaboration.org`.

## Cloudflare dashboard

In the Cloudflare account that manages `aitheoryelaboration.org`:

1. Create a remotely managed tunnel named `suvhlatex`.
2. Add a published application route.
3. Choose the hostname `latex.aitheoryelaboration.org`.
4. Set the service URL to `http://127.0.0.1:8765`.
5. Add a Cloudflare Access policy allowing only your email address.
6. Copy the connector install token, but do not put it in Git.

Cloudflare requires a domain on the account for a permanent published
hostname. Multiple connectors can use the same named tunnel, but this app
uses active/standby operation so that project writes remain consistent.

## Prepare each Linux machine

Install `cloudflared`, then create the private configuration directory:

```bash
mkdir -p ~/.config/suvhlatex
chmod 700 ~/.config/suvhlatex
```

Save the Cloudflare connector token in:

```text
~/.config/suvhlatex/tunnel.token
```

Then protect it:

```bash
chmod 600 ~/.config/suvhlatex/tunnel.token
```

Create `~/.config/suvhlatex/.env` with a strong password and isolated
compilation:

```dotenv
SUVHLATEX_HOST=127.0.0.1
SUVHLATEX_PORT=8765
SUVHLATEX_PASSWORD=replace-with-a-long-random-password
SUVHLATEX_COMPILE_MODE=container
SUVHLATEX_DATA=/home/suvh/projects/suvhlatex/data
```

Docker or Podman must be installed on each machine for container compilation.

Install the user services:

```bash
mkdir -p ~/.config/systemd/user
install -m 0644 deploy/suvhlatex.service ~/.config/systemd/user/
install -m 0644 deploy/suvhlatex-cloudflared.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now suvhlatex.service
```

Enable `suvhlatex-cloudflared.service` only on the current primary machine
until project synchronization and promotion checks are configured:

```bash
systemctl --user enable --now suvhlatex-cloudflared.service
```

On the standby machine, install the service but leave the tunnel disabled:

```bash
systemctl --user disable --now suvhlatex-cloudflared.service 2>/dev/null || true
```

## Project synchronization

The editable projects live in `data/projects/`. They must be synchronized
from the active machine to the standby machine before the standby tunnel is
promoted. Use SSH over Tailscale and keep only one machine writable at a time:

```bash
rsync -az --delete \
  /home/suvh/projects/suvhlatex/data/projects/ \
  peer-host:/home/suvh/projects/suvhlatex/data/projects/
```

Do not run both app instances as independent writers. Cloudflare can route to
multiple tunnel connectors, but that does not merge two separate project
directories.

The automatic promotion watchdog should be installed from the local
`etv-ops` failover tooling after the two hostnames and data paths are known.
Its responsibilities are:

- keep the primary tunnel active during normal operation;
- synchronize projects while the standby is not serving;
- promote the standby after repeated primary failures;
- stop the standby tunnel when the primary returns; and
- synchronize any new standby changes before handing control back.

## Verification

Check the local service first:

```bash
curl -fsS http://127.0.0.1:8765/
systemctl --user status suvhlatex.service
systemctl --user status suvhlatex-cloudflared.service
```

Then open `https://latex.aitheoryelaboration.org` and confirm that the
Cloudflare Access login appears before the editor.

This remains dependent on at least one machine and its internet connection
being available. If both machines share the same router or ISP, an outage of
that connection affects both.
