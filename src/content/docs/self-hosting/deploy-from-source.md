---
slug: deploying-from-source
title: Deploy from Source
description: Building the app manually from source code
index: 5
coverImage: 
---

## The App Setup

#### 0. Prerequisites
You'll need git and Node.js 22 or newer installed.
If you're using [NVM](https://github.com/nvm-sh/nvm) you can run `nvm use` to download and use the version pinned in `.nvmrc`

#### 1. Get the code and install dependencies

```bash
git clone https://github.com/your-org/domain-locker.git
cd domain-locker
npm install
```

#### 3. Configure the environment

If you're using SQLite, then no environmental variables needed 🙂
The database is created at `./data/domain-locker.db` on first use (or set `DL_SQLITE_PATH` to put it somewhere else).

If you do need to set variables, then create a `.env` file in the root of the project.
You can view the full list of [environmental variables](/about/developing/environmental-variables),
or start from the [`.env.sample`](https://github.com/lissy93/domain-locker/blob/main/.env.sample) as a starting point.
You have to restart the app for changes to env vars to take affect.

```bash
touch .env
```

#### 4. Build the app

```bash
npm run build
```

#### 5. Start the app

```bash
node dist/analog/server/index.mjs
```

#### 6. Access the app
Visit `http://localhost:3000` in your browser to access the app.

Set `PORT` to serve it somewhere else

---

## The Database Setup

SQLite is recommended, since it needs no additional setup.

- ![🪶](https://pixelflare.cc/alicia/icons/sqlite.png/w128) [SQLite setup instructions](/about/developing/sqlite-setup)
- ![🐘](https://pixelflare.cc/alicia/icons/postgres.png/w128) [Postgres setup instructions](/about/developing/postgres-setup)
- ![🗃️](https://pixelflare.cc/alicia/icons/supabase/w128) [Supabase setup instructions](/about/developing/supabase-setup)


During development, you can skip the database setup, and connect to our hosted dev db instance, by using [these environment variables](https://github.com/Lissy93/domain-locker/blob/main/.env.sample#L5-L14). This is NOT suitable for production.


<style>
li img {
  margin: 0;
  display: inline;
  width: 16px;
}
</style>
