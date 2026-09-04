---
slug: upgrading
title: Upgrading
description: What changes when you pull a newer image, and what you can tidy up
index: 9
coverImage:
---

Upgrading is a normal image pull. Your database, environment variables and
compose file all keep working, and the app brings its own schema up to date on
first start. Nothing below is required; it is all optional tidying.

## What happens automatically

- **Your database is left alone.** On first start the app notices an existing
  database and records it as already migrated, rather than replaying any
  schema over live tables. Later changes are additive only, so you can roll
  back to the previous release without losing data.
- **Scheduled jobs move inside the app.** Domain updates, uptime monitoring,
  expiry reminders and cleanup now run on a timer in the app itself.
- **Credentials stop being sent to your browser.** The app talks to its own
  API, and the database connection stays on the server.

## Things you can remove

### The updater container

The app schedules its own jobs now, so the `updater` service in
`docker-compose.yml` has nothing left to do. Leaving it running is harmless:
each job takes a lock, so a trigger arriving while that job is already running
is skipped rather than repeated.

To remove it:

```bash
docker compose stop updater && docker compose rm -f updater
```

Then delete the `updater` service from your compose file. If you would rather
keep driving the jobs yourself, set `DL_DISABLE_SCHEDULER=true` and keep
triggering `/api/domain-updater` and friends as before.

### Database credentials saved in your browser

Older versions let you type database credentials into the *Advanced → Database
Connection* page, which stored them in local storage and sent them with every
request. That page is now read-only, and offers to clear anything left behind.
Visit it once and click *Remove stored credentials*.

## Optional: move from Postgres to SQLite

Postgres remains fully supported and nothing pushes you off it. If you set
`DL_PG_*`, Postgres is used exactly as before.

For a smaller setup, a single container with a SQLite file is now enough.
To consolidate an existing install:

```bash
# 1. Stop the app so nothing writes during the copy
docker compose stop app

# 2. Copy Postgres into a SQLite file (Postgres is only read from)
DL_PG_HOST=localhost DL_PG_PORT=5432 DL_PG_USER=postgres \
DL_PG_PASSWORD=yourpassword DL_PG_NAME=domain_locker \
DL_SQLITE_PATH=./domain-locker.db \
  npm run migrate:pg-to-sqlite

# 3. Move the file onto the app's volume, then start with the
#    single-container compose file and no DL_PG_* variables set
```

Keep the Postgres volume until you are happy with the result. Because the app
picks Postgres whenever `DL_PG_*` is set, putting those variables back is all
it takes to switch again.

## New settings worth knowing

| Variable | What it does |
|---|---|
| `DL_SQLITE_PATH` | Where the SQLite file lives (`/data/domain-locker.db` in Docker, `./data/domain-locker.db` otherwise) |
| `DL_AUTH_PASSWORD` | Require a password to use the app. Off by default |
| `DL_API_KEY` | Lets an external scheduler trigger jobs when a password is set |
| `DL_DISABLE_SCHEDULER` | Turn off the internal scheduler and drive jobs yourself |
| `DL_MONITOR_INTERVAL_MINUTES` | How often uptime is checked (default 15) |
| `DL_UPDATER_INTERVAL_MINUTES` | How often domains are refreshed (default daily) |
| `DL_WHOIS_PROVIDERS` | Order of WHOIS sources to try (RDAP first by default) |

## If something looks wrong

The app logs which database it is using and which migrations it applied on
start, so `docker compose logs app` is the first place to look. *Advanced →
Debug Info* shows the same from inside the app.
