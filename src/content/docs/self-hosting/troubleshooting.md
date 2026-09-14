---
slug: troubleshooting
title: Troubleshooting Common Issues
description: Common issues and their solutions and workarounds
noShowInContents: true
index: 11
coverImage:
---

This page covers specific bugs, common user errors, and known limitations.

## Can't fetch domain data / TLD Support
Different TLDs expose different levels of registration data, and the structure of that data can vary between registries and registrars. While most modern TLDs support RDAP (the successor to WHOIS), the amount of publicly accessible information depends on registry policies, locale, and access restrictions. As a result, for some domain extensions certain details (such as registrant information) may not be available for automated retrieval. In these cases, the only workaround to this is to enter this info manually when adding a domain.

Firstly, check weather or not your domain extension is supported at [deployment.rdap.org](https://deployment.rdap.org/)

Then, test out which data is returned, by running `whois example.com`, and the same for RDAP with `https://<rdap-server>/domain/<domain-name>`

---

## Can't fetch subdomains

DNS, as a system can’t automatically fetch all subdomains for a given domain, since there is no central, public database that lists them.

You can enable automatic discovery for subdomains with either [dnsdumpster.com](https://dnsdumpster.com/) or [Shodan](https://www.shodan.io/) (note, Shodan requires pro plan).
- **DNSDumpster**: Sign up for an API key [here](https://dnsdumpster.com/membership/), and then set the the `DNS_DUMPSTER_TOKEN` env var
- **Shodan**: Sign up for an API key [here](https://developer.shodan.io/) (requires paid plan), and then set the `SHODAN_TOKEN` env var

You can choose which service is used for subdomain lookups by setting the `DL_PREFERRED_SUBDOMAIN_PROVIDER` env var to either `shod`,, `dnsdump`, `both` or `none`.

After setting up, you can fetch subdomains for your existing domains by going to `http://[domain-locker]/assets/subdomains/[your-domain]`.

**Why no auto-fetching?** DNS is designed to answer queries for specific records — not to provide a complete index of every subdomain under a domain. So, unless the domain owner exposes a full zone transfer, discovering subdomains requires external scanning, certificate transparency logs, passive DNS data, or large-scale crawling. This is exactly what third-party services aggregate.

---

## Database errors
The app logs which database it's using, and any migrations it applied, when it starts. For problems specific to SQLite, such as where the file lives, permissions on it, or writes timing out, see [SQLite Setup](/about/developing/sqlite-setup).

---

## Some features not visible
User accounts and sign-in aren't available on self-hosted, since they were built for a Supabase-based architecture. All our Supabase code is open source, and so can be self-hosted if you need them, it is just a significantly more involved setup. See [Self-hosting Domain Locker and Supabase](/about/self-hosting/self-hosting-supabase) for more details.

---
