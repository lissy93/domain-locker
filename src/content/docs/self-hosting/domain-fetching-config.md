---
slug: domain-fetching-config
title: Domain Fetching Config
description: How to configure domain data fetching and subdomain discovery for self-hosted Domain Locker instances
coverImage:
index: 10
---

When you add a domain to Domain Locker, the app automatically fetches information about it from WHOIS servers and other sources where available. This includes details like registration dates, expiration dates, nameservers, registrar info, and more.

You can understand how this works from a technical perspective in the [How Add Domain Works](/about/developing/how-add-domain-works) dev docs.

At a high-level, it calls an API endpoint which looks up info from various sources, including registrar, whois, SSL, DNS, subdomains and more. And then auto-fills this into the form, for you to review and save.

**Important**: Before you can save a domain, it must have a registrar and expiration date set. If this cannot be fetched automatically, you'll need to enter it manually.

**Note that**:
- There are some features which won't work out-of-the-box in the self-hosted instance without additional configuration (since they rely on third-party services)
- For some domains and TLD types, certain data may not be publicly available and will need to be entered manually.

---

## Keeping Domain Data Updated

Domains can be updated to fetch the latest info by sending a POST request to the `/api/domain-updater` endpoint.
To keep domains-up-to-date automatically, set up a cron job to call this endpoint periodically.

For example:

```bash
( crontab -l 2>/dev/null; \
  echo "0 3 * * * curl -s -X POST http://app:3000/api/domain-updater"; \
  echo "0 4 * * * curl -s -X POST http://app:3000/api/expiration-reminders" ) | crontab -
```


You can see more about how to do this, as well as about setting up change and expiration notificiations [here](/about/self-hosting/notifications-self-hosted).

---

## Fetching Subdomains

Subdomain discovery is powered by external services. Domain Locker supports two options, either Shodan or DNSDumpster.

Both services work by scanning the internet and building databases of domains, subdomains, IP addresses, and open ports. Domain Locker queries these services to find subdomains associated with your domain.

### Setting Up Subdomain Fetching

To enable subdomain fetching, you need an API key from at least one of these services.

#### Option 1: Using DNSDumpster (Recommended for Self-Hosting)

DNSDumpster is free and works well for most use cases.

Sign up at [dnsdumpster.com](https://dnsdumpster.com/), get your API key from your account settings, and set it as an environment variable:

```bash
DNS_DUMPSTER_TOKEN=your-api-key-here
```

#### Option 2: Using Shodan

**Important**: Shodan requires a paid subscription for API access. The free tier does not support API queries.

Sign up at [shodan.io](https://www.shodan.io/), upgrade to a paid plan, get your API key from your account dashboard, and set it as an environment variable:

```bash
SHODAN_TOKEN=your-api-key-here
```

#### Using Both Services
By default, Domain Locker will automatically detect which service(s) you have configured:
- If neither service is configured, subdomain fetching will be disabled
- If one service is configured, it will be used automatically
- If both are configured, both will be queried for maximum coverage

You can override this behavior by setting the `DL_PREFERRED_SUBDOMAIN_PROVIDER` environment variable:
- `dnsdump` - Only use DNSDumpster (requires `DNS_DUMPSTER_TOKEN` to be set)
- `shod` - Only use Shodan (requires `SHODAN_TOKEN` to be set)
- `both` - Query both services and merge results (requires both tokens)

---

## Unsupported Domains

Not all domains can have their data fetched automatically. Here are some common cases where fetching might fail:

- Restricted TLDs
  - Some ccTLDs (like `.cn`, `.ru`) restrict WHOIS access. Same with certain newer TLDs, like `.horse`
- Domains with privacy protection
  - Most registrats now implement a privacy services, so some owner details may be hidden
- Recently registered domains
  - WHOIS data may take time to propagate for new domains
- Domains with flakey WHOIS servers
  - Some domains have really unreliable WHOIS servers, that can be slow, time out, or limit requests from certain IPs.
  
  
Unfortunately there's not much that can be done by us in these cases, and the only option is to enter the data manually.

---

## Resolving Data Fetching Issues

### Check the logs
See the [Checking logs](/about/developing/checking-logs) docs for instructions on how to view your app logs.
Within the logs you'll likely see a message indicating what went wrong, and why.

### Check Your Environment Variables
See the [Docker docs](/about/self-hosting/general-docker-advice#environmental-variables) for how to set environment variables.

You can either set these in your `.env` file, in the `docker-compose.yml`, directly in your CLI environment, or use a secrets manager of your choice. You can verify which env vars are set correctly, by visiting the `/advanced/debug-info` page. For docs on how environment variables work, see [Environmental Variables](/about/developing/environmental-variables).


### Check Service Availability
If you're using any of the third-party or managed services, then check the [Service Status page](https://domain-locker.com/advanced/status)

### Further Debugging
Check the [Debugging Guide](/about/developing/debugging) for further steps on how to troubleshoot issues.

### Resolving Subdomain Issues

If subdomain fetching isn't working, here are some common issues and solutions:

**1. Subdomain fetching is disabled**
- Error: "Subdomain fetching is not configured"
- Solution: Set at least one API token (`SHODAN_TOKEN` or `DNS_DUMPSTER_TOKEN`)

**2. Service is called despite being disabled**
- If you're seeing API calls to Shodan/DNSDumpster when they shouldn't be used:
  - Check that your preferred provider is set correctly with `DL_PREFERRED_SUBDOMAIN_PROVIDER`
  - Ensure only the tokens you want to use are configured
  - Clear any cached environment variables and restart the container

**3. API authentication failures**
- Shodan: Requires a **paid** API subscription (free tier doesn't support API access)
- DNSDumpster: Free tier should work, but check your API key is valid

**Testing subdomain fetching:**

```bash
# Test the subdomain endpoint
curl "http://localhost:5173/api/domain-subs?domain=bbc.com"

# Verify Shodan API key (requires paid subscription)
curl "https://api.shodan.io/dns/domain/example.com?key=${SHODAN_TOKEN}"

# Verify DNSDumpster API key
curl -H "X-Api-Key: ${DNS_DUMPSTER_TOKEN}" "https://api.dnsdumpster.com/domain/example.com"
```
