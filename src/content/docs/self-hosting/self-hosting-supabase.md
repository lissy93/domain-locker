---
slug: self-hosting-supabase
title: Self-hosting Supabase
description: Enabling full feature access, by self-hosting a Supabase instance
noShowInContents: true
index: 10
coverImage:
---

Deploying Domain Locker on top of a self-hosted Supabase instance gives you user accounts and sign-in. However, the setup process is much more complex and requires considerably higher system resources.

---

### Backstory
In the self-hosted version of Domain Locker, user accounts and sign-in are not available. This isn't us trying to restrict you or gate-keep anything, but rather that Domain Locker was initially built to run on a serverless architecture (Deno functions) and was very tightly integrated with the Supabase ecosystem.

It wasn't until much later, when people started asking for an easier way to self-host Domain Locker, that I started porting the API to a Node-based architecture and the DB to Postgres and SQLite (which makes running in Docker, Kubernetes and self-hosting systems).

Anyway, you can get the account features (like we have on the [domain-locker.com](https://domain-locker.com/) version), by self-hosting your own Supabase instance (instead of using SQLite or Postgres with Node). The only caveat being that... Supabase is a bloody pain to get running!

---

<div class="cta-to-source">
We've open sourced all code, config and schemas for the Supabase version, in <a href="https://github.com/Lissy93/dl-sb-iac">github.com/Lissy93/dl-sb-iac</a> 😀
</div>

<br>

---

### Usage
1. Firstly, setup a Supabase instance. Either with Kubernetes with [these Helm charts](https://github.com/supabase-community/supabase-kubernetes) or using Docker with [like this Dockerfile](https://github.com/supabase-community/supabase-traefik/blob/main/docker-compose.example.yml). For step-by-step instructions, take a look at the [official setup guide](https://supabase.com/docs/guides/self-hosting/docker).
2. Then, fork the [domain locker supabase repo](https://github.com/Lissy93/dl-sb-iac) and deploy all it's functions, schemas and config to your new Supabase instance, by following the instructions in [the readme](https://github.com/Lissy93/dl-sb-iac).

---

### Support
Sorry, but I cannot offer support for the Supabase version 😔. I just found debugging other peoples Supabase setups too time consuming and complex (which was the reason I made the Node Postgres version!).

So to get help, you will need to look at the official Supabase docs and use their support channels. Please don't open issues or send emails with questions about getting Supabase running.


<style>
.cta-to-source {
  background: var(--surface-ground);
    border: 2px solid var(--primary-color);
    border-radius: 3px;
    padding: 0.25rem;
    border-left-width: 6px;
}
</style>
