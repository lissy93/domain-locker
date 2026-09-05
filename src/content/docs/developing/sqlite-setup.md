---
slug: sqlite-setup
title: SQLite Setup
description: Using SQLite, the default database for self-hosted instances
coverImage: 
index: 2
---

SQLite is the default database for self-hosted setups (since 0.3.0). There's nothing to install nor configure.
SQLite will be automatically initialized and selected as your database if you have neither the Postgres, nor Supabase environmental variables configured.

---

## Where the database lives

- If you're building from source, the SQLite DB will be set in `./data/domain-locker.db`
- In Docker, it will be `/data/domain-locker.db` - and you should mount this directory as a volume, so you can backup your DB
- You can change the SQLite DB location by setting the `DL_SQLITE_PATH` env var to any path (which you have access to + write-permission of)

---

## Schema

The schema gets automatically applied on the first request from [`src/server/db/migrations`](https://github.com/Lissy93/domain-locker/tree/main/src/server/db/migrations).
The tables match the Postgres schema shown in [this diagram](/about/developing/postgres-setup).
Whenever you upgrade, the new migrations are auto-applied on start, and your data (if exists) is preserved.

---

## Moving an existing Postgres database across

If you were previously using the Postgres version as a backend, and want to migrate over to the simpler SQLite, then you can do so by:

First, stop the app.
Then, run our migration script with all the Postgres env vars passed in:

```bash
DL_PG_HOST=localhost DL_PG_PORT=5432 DL_PG_USER=postgres \
DL_PG_PASSWORD=your-password DL_PG_NAME=domain_locker \
DL_SQLITE_PATH=./domain-locker.db \
  npm run migrate:pg-to-sqlite
```

Postgres is only read from. Move the resulting file to wherever `DL_SQLITE_PATH` points, unset the `DL_PG_*` variables, and start the app.

Finally, unset all the `DL_PG_*` environmental variables, so that Domain Locker falls back to SQLite mode.

---

## Backups

The database runs in WAL mode, so it has `-wal` and `-shm` files beside it, and copying the `.db` on its own can miss recent writes. Either stop the app and copy all three files, or take a live snapshot:

```bash
sqlite3 /data/domain-locker.db "VACUUM INTO '/backup/domain-locker.db'"
```

The Docker image doesn't include the `sqlite3` CLI, so run that from the host against the volume.

---

## Troubleshooting

**`Cannot open the SQLite database at ...: permission denied`**  
Whoever runs the app can't write to that path. Point `DL_SQLITE_PATH` somewhere writable, or fix the directory's ownership. In Docker this usually means the mounted volume isn't owned by the container's `appuser`.

**Writes occasionally time out**  
SQLite takes one writer at a time and waits 5 seconds before giving up. If you're hitting that regularly, you have enough domains to justify [Postgres](/about/developing/postgres-setup).
