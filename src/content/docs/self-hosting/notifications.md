---
slug: notifications-self-hosted
title: Notifications
description: How to setup alerts for domain changes and upcoming expirations in a self-hosted Domain Locker instance
coverImage:
index: 8
---

The self-hosted version of Domain Locker supports basic notifications, sent via webhooks.
These can alert you about upcoming expirations or important changes to your domains.

It's not (yet) possible to use all notification channels (email, WhatsApp, Signal, Discord, etc) like in the managed version, because these rely upon non-free 3rd party services (which cannot be self-hosted). But as a workaround, ntfy does allow you to hook into their API and call whichever third-parties you like.

## Enabling update crons
Before you can get notified, you need to setup some cron jobs to periodically check for updates and expirations.

In your Docker Compose, add a section for calling these endpoints as a cron. For example:

```yml
  updater:
    image: alpine:3.20
    container_name: domain-locker-updater
    restart: unless-stopped
    depends_on:
      - app
    networks:
      - domain_locker_network
    command: >
      /bin/sh -c "
        apk add --no-cache curl &&
        echo '0 3 * * * /usr/bin/curl -s -X POST http://app:3000/api/domain-updater' > /etc/crontabs/root &&
        echo '0 4 * * * /usr/bin/curl -s -X POST http://app:3000/api/expiration-reminders' >> /etc/crontabs/root &&
        crond -f -L /dev/stdout
      "
```

---

## Push notifications via NTFY

> [ntfy.sh](https://ntfy.sh/) is a free and simple pub-sub notification service, which can delivery push notifications to your devices, when a webhook is triggered.

It's open source ([on GitHub](https://github.com/binwiederhier/ntfy)), and can be [easily self-hosted](https://docs.ntfy.sh/install/), or used via their public instance.

To configure notifications for domain locker, set the following env vars. These can go in your docker-compose (under `app` --> `environment`), or within your `.env` or secret store. 

```
NOTIFY_WEBHOOK_BASE=https://ntfy.sh
NOTIFY_WEBHOOK_TOPIC=my-topic-name
NOTIFY_WEBHOOK_TOKEN=optional-token-if-private
```

---

## Expiration reminders
When a domain is soon to expire, you can get notified about it. This is handled by the `/api/expiration-reminders` endpoint, which needs to be periodically called via a cron job or similar.

You can customize how many days in advance you wanna be notified, by setting the `DL_EXPIRATION_REMINDER_DAYS` environment variable.
This defaults to 90, 30, 7 and 2 days before expiration, but you can change it to whatever you like.

For example:
- `DL_EXPIRATION_REMINDER_DAYS='60'` - will notify you 2 months before expiration.
- `DL_EXPIRATION_REMINDER_DAYS='30,14,7,3,1'` - will notify you 30, 14, 7, 3 and 1 day before expiration.

---

## Change notifications

When something important changes on one of your domains, you can get notified, if you'd like.
This is handled by the `/api/domain-updater` endpoint, which needs to be periodically called via a cron job or similar.

---

## Choosing notification events

You can decide which change events you want to be notified about on a per-domain basis.
- Either do it individually, by editing each domain:
  - `htt://[your-domain-locker]/domains/[my-domain]/edit`
- Or, bulk update notification events all at once:
  - `http://[your-domain-locker]/notifications/edit-events`


![Edit notification events](https://storage.googleapis.com/as93-screenshots/domain-locker/edit-notification-events.png)

---

## Supported notification events

| Event Type | Description |
|------------|-------------|
| Domain Expiration | Notifies you when a domain is about to expire, based on the configured reminder days. |
| IP Change | Notifies you when the IP address the domain points to changes. Note: If you use a firewall service like Cloudflare, this is NOT recommended, as the IP address will change frequently. |
| Registrar Change | Notifies you when the domain is transferred to a different registrar. |
| WHOIS Change | Notifies you when any WHOIS records change. |
| DNS Change | Notifies you when any DNS records are added, removed or amended. Note: If data fetching fails, this may trigger false positives. See troubleshooting below. |
| SSL Expiry | Notifies you when an SSL certificate is due to expire. Note: This is not recommended if you have auto-SSL, as the certificates have a short lifespan and are renewed automatically. |
| SSL Change | Notifies you when any attributes in an SSL certificate change. Note: This is not recommended if you have auto-SSL, as the certificates have a short lifespan and so will change frequently. |
| Host Change | Notifies you when the domain is moved to a different host. |
| Security Features Change | Notifies you when any security features on your domain are added, removed or amended. |


If you consistently get false notifications for a specific domain, you may want to disable change notifications for that domain specifically while keeping them enabled for others.
