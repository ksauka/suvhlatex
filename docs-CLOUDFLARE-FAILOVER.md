# Cloudflare Quick Tunnel and two-machine failover

The current setup exposes `suvhlatex` through a Cloudflare Quick Tunnel. This
does not use the institutional Cloudflare account, a domain, or a tunnel
token. It follows the same local-service pattern used by `indlu`.

When you later move away from the institution, the Quick Tunnel can be
replaced with the named-tunnel service included in this repository.

## Target layout

```text
https://random-words.trycloudflare.com
              |
       Cloudflare Quick Tunnel
              |
        http://127.0.0.1:8765
```

The URL is printed by `cloudflared` and is also available in the service log:

```bash
journalctl --user -u suvhlatex-cloudflared.service --no-pager | grep trycloudflare
```

The URL changes when the tunnel restarts. A second machine running its own
Quick Tunnel receives a different URL; Quick Tunnels therefore do not provide
one shared failover address.

## Start automatically whenever WSL is running

This is the same pattern used by `indlu`. First make sure systemd is enabled
inside the WSL distribution. In `/etc/wsl.conf`, use:

```ini
[boot]
systemd=true
```

After restarting WSL from Windows, create the private app configuration as
described below, then run this once from the repository:

```bash
bash deploy/install-wsl-services.sh
```

The installer enables user lingering and starts both services. From then on,
when this WSL distribution is running, the LaTeX app and its Quick Tunnel run
without an open terminal. It does not start WSL itself if Windows has stopped
the distribution; it starts the services as soon as WSL starts.

## Prepare each Linux machine

Install `cloudflared`, then create the private configuration directory:

```bash
mkdir -p ~/.config/suvhlatex
chmod 700 ~/.config/suvhlatex
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

The installer above installs and enables the user services. If you prefer to
install them manually:

```bash
mkdir -p ~/.config/systemd/user
install -m 0644 deploy/suvhlatex.service ~/.config/systemd/user/
install -m 0644 deploy/suvhlatex-cloudflared.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now suvhlatex.service
```

Enable `suvhlatex-cloudflared.service` on the machine you want to expose:

```bash
systemctl --user enable --now suvhlatex-cloudflared.service
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

The automatic promotion watchdog should only be installed after migrating to
a named Cloudflare Tunnel. With Quick Tunnels, each machine has a different
public URL, so there is no single URL for the watchdog to preserve.
Its responsibilities are:

- keep the primary tunnel active during normal operation;
- synchronize projects while the standby is not serving;
- promote the standby after repeated primary failures;
- stop the standby tunnel when the primary returns; and
- synchronize any new standby changes before handing control back.

## Later migration to a stable domain

When the institutional Cloudflare account is no longer needed, create a named
tunnel for a domain you control. Install
`deploy/suvhlatex-cloudflared-named.service` instead of the Quick Tunnel
service, place its token at `~/.config/suvhlatex/tunnel.token`, and configure
the public hostname in Cloudflare. At that point the desktop and laptop can
share one stable hostname and use active/standby failover.

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
