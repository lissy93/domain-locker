---
slug: general-docker-advice
title: Docker Tips
description: Securing, monitoring, backing up and generally maintaining your container
noShowInContents: true
index: 9
coverImage:
---

## Environmental Variables

Environment variables control how Domain Locker behaves. You can set them in several ways:

**In docker-compose.yml:**
```yaml
environment:
  DL_AUTH_PASSWORD: your-strong-password
  DL_SQLITE_PATH: /data/domain-locker.db
```

**In a .env file:**
```bash
DL_AUTH_PASSWORD=your-strong-password
DL_DNSDUMP_URL=https://api.dnsdumpster.com/domain/
DNS_DUMPSTER_TOKEN=your-api-key
```

**At runtime:**
```bash
docker run -e DL_AUTH_PASSWORD=secret domain-locker
```

Never commit secrets to version control. Use `.env` files and restrict permissions with `chmod 600 .env`. For production, consider [Docker Secrets](https://docs.docker.com/engine/swarm/secrets/) or a secrets manager like [HashiCorp Vault](https://www.vaultproject.io/).

For more details on how Domain Locker handles environmental variables, see [Environmental Variables](/about/developing/environmental-variables).

---

## Using Docker Secrets

Docker Secrets provide a secure way to store sensitive data like passwords and API keys. Any environment variable can be read from a file instead, by setting `<VARIABLE>_FILE` to the path of that file.

**Create secret files:**
```bash
mkdir -p secrets
echo 'your-strong-password' > secrets/dl_auth_password.txt
chmod 600 secrets/*
```

**Update docker-compose.yml:**
```yaml
secrets:
  dl_auth_password:
    file: ./secrets/dl_auth_password.txt

services:
  app:
    secrets:
      - dl_auth_password
    environment:
      DL_AUTH_PASSWORD_FILE: /run/secrets/dl_auth_password
```

This works for any variable, such as `DL_PG_PASSWORD_FILE` or `SUPABASE_ANON_KEY_FILE`.
The file takes precedence over the variable itself, and configurations without secrets continue to work unchanged.

---

## Running Commands

Execute commands inside the running container:

```bash
docker exec -it domain-locker /bin/sh
```

View all running containers:

```bash
docker ps
```

---

## Logs

View application logs:

```bash
docker logs domain-locker --follow
```

If you're running Postgres, it logs to its own container:

```bash
docker logs domain-locker-db
```

---

## Updating

Pull the latest image and restart:

```bash
docker compose pull
docker compose up -d
```

For automatic updates, use [Watchtower](https://containrrr.dev/watchtower/):

```bash
docker run -d \
  --name watchtower \
  --restart=unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower
```

---

## Backing Up

Back up the data volume:

```bash
docker run --rm \
  -v domain_locker_data:/volume \
  -v /tmp:/backup alpine \
  tar -cjf /backup/domain-locker-data.tar.bz2 -C /volume .
```

SQLite runs in WAL mode, so stop the app first, or take a live snapshot from the host with `sqlite3 /path/to/domain-locker.db "VACUUM INTO '/backup/domain-locker.db'"`. If you're running Postgres, back up the `domain_locker_postgres_data` volume instead, or use `pg_dump`.

For automated backups, use [offen/docker-volume-backup](https://github.com/offen/docker-volume-backup). Store backups offsite with [rclone](https://rclone.org/) or [restic](https://restic.net/).

---

## Authentication

You can password-protect your instance by setting `DL_AUTH_PASSWORD`. It's a single shared password though, so if you need multi-user authentication, it's better to integrate into your own current auth solution for access control.

You've got several options:
- **Reverse proxy authentication** with [Authelia](https://www.authelia.com/), [Authentik](https://goauthentik.io/), or [oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/).
- **VPN access** with [WireGuard](https://www.wireguard.com/) or [Tailscale](https://tailscale.com/) to restrict network access.
- **Basic auth** via your reverse proxy (Nginx, Caddy, Traefik).

If you're self-hosting Supabase, then you can enable Supabase Auth, add some OAuth SSO providers, enable RLS and connect Domain Locker to it. That's how we do in on the managed instance

---

## Auto-Start on Boot

All containers use `restart: unless-stopped` in the docker-compose file, which ensures they start automatically after a system reboot or crash.

---

## Remote Access

For secure remote access:

- [Tailscale](https://tailscale.com/) - Zero-config mesh VPN
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) - Expose services without opening ports
- [WireGuard](https://www.wireguard.com/) - The bestest vpn, fast and modern

Never expose your database directly to the internet

---

## Custom Domain

Point your domain to your server with an A or CNAME record, then configure your reverse proxy.

For local testing, edit `/etc/hosts`:

```bash
127.0.0.1 locker.local
```

---

## SSL Certificates

Use a reverse proxy with automatic HTTPS:

### With [Caddy](https://caddyserver.com/)

```text
locker.example.com {
  reverse_proxy localhost:3000
}
```

Caddy automatically handles Let's Encrypt certificates.

### With [Traefik](https://traefik.io/)
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.domainlocker.rule=Host(`locker.example.com`)"
  - "traefik.http.routers.domainlocker.entrypoints=https"
  - "traefik.http.routers.domainlocker.tls.certresolver=le"
```

### With [Nginx](https://nginx.org/)

Use [Certbot](https://certbot.eff.org/) for Let's Encrypt certificates

---

## Healthchecks

Domain Locker includes a healthcheck for the app (and for Postgres, if you're running it). View health status:

```bash
docker inspect --format '{{json .State.Health}}' domain-locker
```

You can use [Autoheal](https://github.com/willfarrell/docker-autoheal) to automatically restart unhealthy containers:

```bash
docker run -d \
  --name autoheal \
  --restart=always \
  -e AUTOHEAL_CONTAINER_LABEL=all \
  -v /var/run/docker.sock:/var/run/docker.sock \
  willfarrell/autoheal
```

---

## Monitoring
There's several things you can monitor, and some good tools to help with that:
- [Uptime Kuma](https://github.com/louislam/uptime-kuma) - Monitor service availability
- [Grafana](https://grafana.com/) + [Prometheus](https://prometheus.io/) - Metrics and dashboards
- [GlitchTip](https://glitchtip.com/) - Error tracking (set `DL_GLITCHTIP_DSN`)
- [cAdvisor](https://github.com/google/cadvisor) - Container resource monitoring

---

## Performance Stats

View real-time container resource usage:

```bash
docker stats
```

For detailed metrics, you can use [Prometheus](https://prometheus.io/) with [node_exporter](https://github.com/prometheus/node_exporter) and [cAdvisor](https://github.com/google/cadvisor)

---

## Container Management Tools

If you prefer to manage your containers in a more visual way, here's some good tools:
- [Portainer](https://www.portainer.io/) - Web UI for managing containers
- [Lazydocker](https://github.com/jesseduffield/lazydocker) - Terminal UI for Docker
- [Dockge](https://github.com/louislam/dockge) - Docker Compose stack manager

---

## Kubernetes Deployment

For Kubernetes deployments with Helm charts, see [Deploying with Kubernetes](/about/self-hosting/deploying-with-kubernetes-helm-charts).

---

## Security Best Practices

- Run containers as non-root users (Domain Locker uses `appuser`)
- Keep images updated to patch vulnerabilities
- Use [Docker Scout](https://docs.docker.com/scout/) or [Trivy](https://trivy.dev/) for security scanning
- Limit exposed ports and use a firewall
- Enable Docker's [user namespace remapping](https://docs.docker.com/engine/security/userns-remap/) for additional isolation

---

## Scheduling Tasks

The app runs its own jobs for domain updates, monitoring, expiration reminders and cleanup. To change how often, set the intervals (in minutes) in your `docker-compose.yml`:

```yaml
environment:
  DL_UPDATER_INTERVAL_MINUTES: 1440
  DL_MONITOR_INTERVAL_MINUTES: 15
  DL_REMINDERS_INTERVAL_MINUTES: 1440
  DL_CLEANUP_INTERVAL_MINUTES: 10080
```

To drive them from your own scheduler instead, set `DL_DISABLE_SCHEDULER=true`, then POST to `/api/domain-updater`, `/api/domain-monitor`, `/api/expiration-reminders` and `/api/cleanup-monitor-data` yourself. For that, consider [Ofelia](https://github.com/mcuadros/ofelia)

---

## Providing Custom Assets

You can mount custom assets using volumes, e.g.

```bash
-v ~/my-logo.svg:/app/dist/analog/public/logo.svg
```

Note that static files are served from `/app/dist/analog/public/` (not `/app/src/assets/`)

---

## Database Management

Your SQLite database is a single file, at `/data/domain-locker.db` on the app's volume. To inspect it, copy it off the volume and open it in any SQLite client, such as [DB Browser for SQLite](https://sqlitebrowser.org/) or [Beekeeper Studio](https://www.beekeeperstudio.io/). Note that the image doesn't include the `sqlite3` CLI.

If you're running Postgres, you can connect to it directly using any Postgres client. For example
- [pgAdmin](https://www.pgadmin.org/)
- [Postico](https://eggerapps.at/postico2/)
- [DBeaver](https://dbeaver.io/)

Connect with these credentials from your `.env` or docker-compose, for example:
- Host: `localhost`
- Port: `5432`
- Database: `domain_locker`
- User: `postgres`
- Password: (your `DL_PG_PASSWORD`)

---

## Resource Limits

If you need to limit container resources to prevent one service from consuming all system memory

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

---

## Logging Configuration

To configure log retention (e.g. to prevent disk space issues), set logging options in `docker-compose.yml`:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

For centralized logging, take a look at:
- [Loki](https://grafana.com/oss/loki/)
- [ELK stack](https://www.elastic.co/elastic-stack)

---

## Network Configuration

Domain Locker uses a bridge network by default.
For more complex setups, consider using [Traefik](https://traefik.io/) as a reverse proxy with automatic service discovery

---

## Data Persistence

The `domain_locker_data` volume persists your domain data. To inspect it:

```bash
docker volume inspect domain_locker_data
```

---

## Troubleshooting

The app logs which database it's using on start, so `docker logs domain-locker` is the first place to look.

If you're running Postgres and the app can't connect to it, check that both containers are on the same network:

```bash
docker network inspect domain_locker_network
```

Verify the database is healthy:

```bash
docker exec domain-locker-db pg_isready -U postgres
```

---

## Building from Source

To build and run a custom version

```bash
git clone https://github.com/lissy93/domain-locker
cd domain-locker
npm install
npm run build
docker build -t domain-locker:custom .
docker run -p 3000:3000 domain-locker:custom
```

See the [Developing docs](/about/developing) for more info on building from source.
