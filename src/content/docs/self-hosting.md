---
title: Self-Hosting Domain Locker
slug: self-hosting  
meta:
  - name: description
    content: About Page Description
  - property: og:title
    content: About
---

### Important Disclaimer
<blockquote class="warning">
⚠️ The self-hosted edition comes with no warranty. There are no guarantees for functionality and maintaining, securing and managing the infrastructure will be your responsibility. The developer cannot be held liable for any damages or losses caused by the use of the self-hosted edition.
</blockquote>

<blockquote class="error">
‼️ Domain Locker is not intended to be publicly exposed to the internet. It does not come with authentication, and may be susceptible unrestricted or arbitrary SQL execution unless properly secured behind a firewall, with correct access controls implemented.
</blockquote>

---

## Prerequisites

In order to self-host Domain Locker, you will need a server (such as a Raspberry Pi, laptop, VM or VPS).
Domain Locker is intended to be run with Docker, so you will need to have Docker and Docker Compose installed.

---

## Deployment

- ![🐳](https://pixelflare.cc/alicia/icons/docker/w128) [With Docker](/about/self-hosting/deploying-with-docker-compose)
- ![💠](https://pixelflare.cc/alicia/icons/kubernetes/w128) [With Kubernetes](/about/self-hosting/deploying-with-kubernetes-helm-charts)
- ![🔶](https://pixelflare.cc/alicia/icons/proxmox/w128) [On Proxmox VE](/about/self-hosting/proxmox-community-script)
- ![☂️](https://pixelflare.cc/alicia/icons/umbrel/w128) [On Umbrel](/about/self-hosting/umbrel-os-app)
- ![🔹](https://pixelflare.cc/alicia/icons/easypanel/w128) [On easypanel](/about/self-hosting/deploying-on-easypanel-io)
- ![🖥️](https://pixelflare.cc/alicia/icons/truenas/w128) [On TruNAS](/about/self-hosting/deploy-to-truenas)
- ![💽](https://pixelflare.cc/alicia/icons/unraid/w128) [On Unraid](/about/self-hosting/deploying-on-unraid)
- ![🐙](https://pixelflare.cc/alicia/icons/github/w128) [From Source](/about/self-hosting/deploying-from-source)
- ![🗃️](https://pixelflare.cc/alicia/icons/supabase/w128) [With Supabase](/about/self-hosting/self-hosting-supabase)

#### One-Liner

```
curl -fsSL https://install.domain-locker.com | bash
```

---

## Resolving Issues

- [Debugging Docs](/about/developing/debugging) - Walk through of diagnosing issues
- [Checking Logs](/about/developing/checking-logs) - How view and understand the build and runtime logs
- [Troubleshooting](/about/self-hosting/troubleshooting) - Solutions for common issues and outline of known limitations
- [3rd-party Docs](/about/developing/third-party-docs) - Signposting to docs for related packages and services
- [Support](/about/support/self-hosted-support) - Contact details for support queries (currently unavailable for free users)

---

## Developing

- [Dev Setup and Docs](/about/developing)
- [Source Code](https://github.com/lissy93/domain-locker)

---

## See Also
- [Auto-Fetching Domain Info](/about/self-hosting/domain-fetching-config)
- [Configuring Expiry Notifications](/about/self-hosting/notifications-self-hosted)
- [Docker Best Practices](/about/self-hosting/general-docker-advice)
- [Architecture Overview](/about/self-hosting/understanding-the-architecture)
- [Conditions for Public Instances](/about/self-hosting/guidelines-for-public-instance)


<style>

a:visited {
  color: var(--primary-400);
}

blockquote.warning, blockquote.error {
  border-radius: 0.25rem;
  padding: 0.5rem;
  margin: 0.25rem 0 1rem 0;
  font-size: 0.8rem;
  line-height: 1rem;
  p {
    margin: 0.2rem 0 0 0;
  }
}

.warning {
    background-color: var(--yellow-200);
    color: var(--yellow-800);
    border: 1px solid var(--yellow-600);
}
.error {
    background-color: var(--red-200);
    color: var(--red-800);
    border: 1px solid var(--red-600);
}
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

li img {
  margin: 0;
  display: inline;
  width: 16px;
}

</style>
