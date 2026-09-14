---
slug: developing
title: Development Setup
description: Get started with developing features on Domain Locker
coverImage: https://images.unsplash.com/photo-1493612276216-ee3925520721?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=464&q=80
---

## App Setup

### Development Environment

```
git clone git@github.com:Lissy93/domain-locker.git
cd domain-locker
npm install
cp .env.example .env
npm run dev
```

### Build for Production

To build for production, use `npm run build`, then `npm start`.
Or to build for a particular platform, use the `build:vercel`, `build:netlify` commands.

---

## Database Setup

While running in dev, you will be automatically connected to our public development Supabase instance,
so there is no need to setup or configure a database. (Note that the dev database is frequently wiped).

Alternatively, you can deploy your own database, either SQLite, Postgres, or a (self-hosted or Pro) Supabase instance.

### Option 1) SQLite

There's nothing to set up. With no Postgres or Supabase env vars set, the app creates a SQLite database at `./data/domain-locker.db` on first use. See [SQLite Setup](/about/developing/sqlite-setup).

### Option 2) Postgres

Create a database and user, following the setup instructions in [Postgres Setup](/about/developing/postgres-setup).

You'll then just need to pass the following env vars to the app, so it can connect to your Postgres instance. The schema is applied automatically on first start.

```
DL_PG_HOST='localhost'
DL_PG_PORT='5432'
DL_PG_USER='postgres'
DL_PG_PASSWORD='supersecret'
DL_PG_NAME='domain_locker'
```

### Option 3) Supabase

Deploy a new Supabase instance, apply the config from [dl-sb-iac](https://github.com/Lissy93/dl-sb-iac) and set the following environmental variables:

```
SUPABASE_URL=xxx
SUPABASE_ANON_KEY=xx
```

<details>
<summary>Schema</summary>

The schema can be downloaded from [here](https://github.com/Lissy93/domain-locker/blob/main/db/schema.sql).

Below is a high-level class-diagram.

![Schema](https://gist.github.com/user-attachments/assets/4ddf35df-dad6-4820-b667-6417ef406277)

</details>


---

## Resolving Issues

If you run into issues, see our [Debugging Guide](/about/developing/debugging).

---

## Architecture

<div class="screenshots-wrap">
<img src="/articles/domain-locker-arch-self-hosted.png" >
<img src="/articles/domain-locker-arch-managed.png" >
</div>

### Self-Hosted Version

The self-hosted app is very simple, and runs in a single container:
- The app itself (client, server, scheduled jobs and optional webhooks for notifications)
- Your data, in a SQLite file, or in Postgres if you'd rather run one

### Managed Version

This differs slightly from the managed instance, which has the same core web app, but is reliant upon some non-free services for extra features and security.

Why the difference? Running a SaaS app requires some additional components/layers in order to offer users the best possible experience. For example, the managed app also needs to cover the following areas:
- Multiple environments, automated CI/CD
- An ORM between client and server
- Feature flagging and role-based features
- Domain name, DNS, Captcha, WAF, cache, SSL
- Billing and user plan management
- Authentication, authorization and SSO
- STMP mailer service, and Twilio SMS
- Notification channels for WhatsApp, SMS, Signal, etc
- Backups for database, config, logs, assets
- Observability for bugs, payments, availability, traces
- User support for queries, billing, bugs, feedback, etc

<!-- ![architecture](https://gist.github.com/user-attachments/assets/00b8b790-ab9d-49f8-ae88-a5dca4120e73) -->


<style>
  .screenshots-wrap {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  img {
    height: 550px;
    width: auto;
    max-width: 100%;
    object-fit: contain;
    margin: 0;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
  }
  @media (max-width: 600px) {
  flex-direction: column;
  align-items: center;
    img {
      height: auto;
      width: 100%;
      max-height: 550px;
    }
}
}
</style>
