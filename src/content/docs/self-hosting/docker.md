---
slug: deploying-with-docker-compose
title: Docker Deployment
description: How to deploy Domain Locker using docker compose
coverImage: 
index: 1
---

Docker is the easiest way to run Domain Locker. We publish tagged x-platform images to DockerHub and GHCR for every version.

## Docker Run

```bash
docker run -p 3000:3000 -v domain-locker-data:/data lissy93/domain-locker
```

## Docker Compose

- Ensure you have Docker and Docker Compose [installed](https://docs.docker.com/engine/install/) on your system.
- Download our [`docker-compose.yml`](https://github.com/Lissy93/domain-locker/blob/main/docker-compose.yml) to your current directory
- Make any changes (if you feel like it)
- Run `docker compose up` to start the app
- Visit `http://localhost:3000` in your browser

### Sample Docker Compose

<iframe frameborder="0" scrolling="no" style="width:100%; height:1696px;" allow="clipboard-write" src="https://github-embed.as93.net/iframe.html?target=https%3A%2F%2Fgithub.com%2FLissy93%2Fdomain-locker%2Fblob%2Fmain%2Fdocker-compose.yml&style=tokyo-night-dark&type=code&showBorder=on&showLineNumbers=on&showFileMeta=on&showFullPath=on&showCopy=on"></iframe>

### Postgres Version
Prior to 0.3.0 the default self-hosted database for Domain Locker was Postgres.
If you still wanna use that, here's a Postgres compose: [`docker-compose.postgres.yml`](https://github.com/Lissy93/domain-locker/blob/main/docker-compose.postgres.yml)
