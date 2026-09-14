---
slug: checking-logs
title: Checking Logs
description: Start debugging an issue, or monitor the app with logs
coverImage: 
index: 7
---

When something goes wrong, logs are usually the first and best place to look.

---

### Where to Start

Start from where you notice the issue:

- If **the app loads but something breaks when you click or submit**, check the **browser console** and **network tab**
- If the **app doesn’t start at all**, start with the **build or deploy logs**
- If **data isn’t showing up**, check the **server logs** and **database logs**
- If **network requests fail**, check the **Docker logs**, or look for **CORS/network issues**

Once you’ve narrowed it down, follow the relevant section below.

---

### Client-side Logs

Domain Locker includes a built-in debug panel, which you can access [`/advanced/error-logs`](/advanced/error-logs).

Beyond that, you can access recent logs and errors in the browser console. To view, open the Developer Tools (usually `F12` or right-click → Inspect → Console tab). This will show JavaScript errors, uncaught exceptions, and network request failures.

---

### Server-side Logs

If you’re running the app locally or via Docker, logs will appear in the terminal window.
These include API errors, backend crashes, database failures, and more.

If you're using Docker Compose:

```bash
docker compose logs -f
```

Add `web`, `api`, or the service name to scope logs:

```bash
docker compose logs -f web
```

You can also view just the last 100 lines, useful when things get noisy:

```bash
docker compose logs --tail=100 web
```

Look out for:
- Stack traces
- Connection failures
- DB-related errors (auth, RLS, etc)

---

### Build-time Logs

#### A) GitHub Actions  
If you're building your own Docker image with GitHub Actions, check the Actions tab on GitHub. Any failed builds will show up clearly. Pay attention to:
- Missing files
- Failing tests
- Env var errors
- Invalid Dockerfile steps

#### B) Vercel / Netlify  
If you're deploying to a host like Vercel, check the Deployments tab in your dashboard. You’ll see real-time build logs with clear error messages if anything goes wrong.

---

### Runtime Logs (Docker)

Once deployed, logs continue to stream via Docker. You can always reattach to logs with:

```bash
docker compose logs -f
```

Or check specific services (e.g., `api`, `db`, `web`).

To restart containers cleanly (and refresh logs):

```bash
docker compose down && docker compose up -d
```

Tip: Don’t let logs grow endlessly — pipe them into a logging tool like `logrotate` or forward to a service like Loki or Papertrail if you're running this in production.

---

### Database Logs

The app logs which database it's using, and any migrations it applied, when it starts. SQLite has no log of its own, so that's all there is to check.

If you’re self-hosting Postgres, its logs are stored by default in `/var/log/postgresql/`.
You’ll see connection attempts, failed queries, permissions issues, and constraint violations.

```bash
sudo tail -f /var/log/postgresql/postgresql-<version>-main.log
```

Also handy to see current activity and any hanging queries, with:

```bash
psql -d your_db -c "SELECT * FROM pg_stat_activity;"
```

---

### Network Logs & Troubleshooting

#### Network Tab (in Browser DevTools)  
This shows all client-side HTTP requests. You can inspect failed requests and view headers, responses, and status codes.

Use this to:
- Check if API endpoints are reachable
- Confirm that responses look as expected
- Catch any `CORS` or `403 Forbidden` issues

#### Docker Networking  
If containers can’t talk to each other (e.g. API can’t reach Postgres), inspect Docker network settings:

```bash
docker network ls
docker network inspect <network-name>
```

And confirm services are on the same bridge.


