---
slug: supabase-setup
title: Supabase Setup
description: Configuring a self-hosted Supabase instance for Domain Locker
coverImage: 
index: 4
---

The code for the Supabase setup is at [github.com/Lissy93/dl-sb-iac](https://github.com/Lissy93/dl-sb-iac).
This covers the config, schema, templates, migrations as well as all serverless functions, and is automated with GitHub Actions.

We use Supabase on the managed instance, for it's PostgresDB, auth handling and serverless functions.

<blockquote class="markdown-alert markdown-alert-note">
	
[!NOTE]<br>
Setting up Supabase for the first time can be quite tricky, and we cannot offer support for it.<br>
There is also some reliance on non-free third-parties, such as Google, Twilio, Resend, Turnstile and Stripe.<br>
<b>Where possible, we recommend self-hosted users to use SQLite or Postgres instead.</b>
</blockquote>

---

### File Structure

```
dl-sb-iac/
├─ supabase/
│  ├─ functions/    # Deno Edge functions
│  ├─ migrations/   # Database schema
│  ├─ templates/    # Mailer templates
│  ╰─ config.toml   # Supabase configuration
├─ .github/         # Repo admin, and GH Actions
│  ├─ workflows/    # CI/CD files for deployment
│  ╰─ README.txt    # Documentation
├─ Makefile         # Project commands
├─ deno.json        # Deno project config
╰─ .gitignore       # Stuff to not commit
```

---

### Developing

#### Pre-requisites:
  - Install Git, Deno, Supabase CLI, Postgres and Docker on your local machine
  - Deploy a Supabase instance. See https://supabase.io/docs/guides/self-hosting
  - Configure all the required environmental variables for services (see below)

#### Project setup:
- `git clone git@github.com:Lissy93/dl-sb-iac.git`
- `supabase link --project-ref PROJECT_REF`

#### Development:
- `supabase start`
- `supabase status`
- `supabase functions serve`

---

### Deploying

#### Manual Deploy
- `supabase secrets set-from-env` - _Set environments_
- `supabase config push` - _Apply configuration_
- `supabase db push` -  _Deploy schema_
- `supabase functions deploy` - _Deploy functions_

See the [`Makefile`](https://github.com/Lissy93/dl-sb-iac/blob/main/Makefile) for all deployment commands.

#### Automated Deploy
The easiest way to deploy is via GitHub Actions, which we use for CI/CD.<br>
Just fork the repo, enable actions, set the env vars, and push to main.<br>
This will trigger the [`supabase.yml`](https://github.com/Lissy93/dl-sb-iac/blob/main/.github/workflows/supabase.yml) workflow, which will deploy the project.

You'll need to configure the following GitHub secrets to authenticate:
- `SUPABASE_PROJECT_ID` - _The Supabase project ID_
- `SUPABASE_ACCESS_TOKEN` - _The Supabase access token_
- `SUPABASE_DB_PASSWORD` - _The Postgres password for your Supabase DB_
- `SUPABASE_ENV_FILE` - _Raw text env vars for all else you need (see below)_

---

### Edge Functions

| **Category**         | **Function**           | **Description**                                                                 |
|-----------------------|------------------------|---------------------------------------------------------------------------------|
| **Stripe and Billing**| `cancel-subscription` | Cancels a user's subscription                                                  |
|                       | `checkout-session`    | Creates a new checkout session for a subscription                              |
|                       | `stripe-webhook`      | Handles incoming events triggered from Stripe                                  |
|                       | `new-user-billing`    | Adds a billing record for new users + checks if sponsor                        |
| **User Management**   | `delete-account`      | Deletes a user account and all associated data                                 |
|                       | `export-data`         | Exports all (selected) data for a user in a given format                       |
| **Domain Management** | `trigger-updates`     | Selects all domains for users, and triggers domain-updater                     |
|                       | `domain-updater`      | Updates domains with latest info, triggers notifications                       |
|                       | `send-notification`   | Sends a notification to user id with message                                   |
|                       | `website-monitor`     | Gets response info for each (pro) domain, updates db                           |
| **Info Routes**       | `domain-info`         | Fetches all info for any given domain name                                     |
|                       | `domain-subs`         | Fetches all subdomains for any given domain                                    |

---

### Crons

| **Schedule** | **Nodename** | **Nodeport** | **Database** | **Username** | **Job Name**               | **Endpoint**                                                   |
|--------------|--------------|--------------|--------------|--------------|----------------------------|----------------------------------------------------------------|
| 0 4 * * *    | localhost    | 5432         | postgres     | postgres     | run_domain_update_job      | https://[supabase-instance]/functions/v1/trigger-updates      |
| 0 * * * *    | localhost    | 5432         | postgres     | postgres     | run_website_monitor_job    | https://[supabase-instance]/functions/v1/website-monitor      |


---

### Environmental Variables

| **Category**         | **Variable**                          | **Description**                                      |
|-----------------------|---------------------------------------|-----------------------------------------------------|
| **Supabase**          | `DB_URL`                             | The URL to your Supabase instance and project        |
|                       | `DB_KEY`                             | The anon key to your new Supabase project            |
| **Authentication**    | `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`   | Google OAuth Client ID                        |
|                       | `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`      | Google OAuth Secret                           |
|                       | `SUPABASE_AUTH_EXTERNAL_FACEBOOK_CLIENT_ID` | Facebook OAuth Client ID                      |
|                       | `SUPABASE_AUTH_EXTERNAL_FACEBOOK_SECRET`    | Facebook OAuth Secret                         |
|                       | `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID`   | GitHub OAuth Client ID                        |
|                       | `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`      | GitHub OAuth Secret                           |
| **API Endpoints**     | `AS93_DOMAIN_INFO_URL`               | The URL to our external domain info API              |
|                       | `AS93_DOMAIN_INFO_KEY`               | The key for the domain info API                      |
|                       | `AS93_SPONSORS_API`                  | The URL to our GitHub sponsors API                   |
| **Worker Endpoints**  | `WORKER_DOMAIN_UPDATER_URL`          | The URL to domain-updater function                   |
|                       | `WORKER_SEND_NOTIFICATION_URL`       | The URL to send-notification function                |
| **Stripe**            | `STRIPE_SECRET_KEY`                  | Stripe secret key (starting with sk_live_ or sk_test_) |
|                       | `STRIPE_WEBHOOK_SECRET`              | Stripe webhook secret (starting with whsec_)         |
| **Stripe Prices**     | `STRIPE_PRICE_HM`                    | Stripe price ID for the hobby monthly plan (starting price_) |
|                       | `STRIPE_PRICE_HA`                    | Price ID for the hobby annual plan                   |
|                       | `STRIPE_PRICE_PM`                    | Price ID for the pro monthly plan                    |
|                       | `STRIPE_PRICE_PA`                    | Price ID for the pro annual plan                     |
| **Resend**            | `RESEND_API_KEY`                     | The API key for the Resend service (send access)     |
|                       | `RESEND_SENDER`                      | The sender email for Resend                          |
| **Twilio**            | `TWILIO_SID`                         | Twilio account SID                                   |
|                       | `TWILIO_AUTH_TOKEN`                  | Twilio auth token                                    |
|                       | `TWILIO_PHONE_NUMBER`                | Twilio phone number                                  |
|                       | `TWILIO_WHATSAPP_NUMBER`             | Twilio WhatsApp number                               |
| **Telegram**          | `TELEGRAM_BOT_TOKEN`                 | The token for the telegram notification bot          |

It's advisable to use a secret store for this. We use Supabase Vault.
Or, you can pass secrets to Supabase, by running:
`supabase secrets set --env-file supabase/functions/.env`

---

### Domain Updating Flow

```mermaid
sequenceDiagram
  autonumber
  participant Cron as Cron Job
  participant Trigger as trigger-updates
  participant DB as Supabase DB
  participant Updater as domain-updater
  participant External as domain-info
  participant Notify as send-notification

  Cron->>Trigger: POST /trigger-updates
  Trigger->>DB: Fetch domains (user_id, domain)
  loop For each domain
    Trigger->>Updater: POST { domain, user_id }
    Updater->>External: Fetch latest info
    Updater->>DB: Compare + update domain data
    Updater->>Notify: Trigger notification (if needed)
  end
```

---

### Notification Dispatching Flow

```mermaid
flowchart TD
  input[User ID + Message]
  fetchPrefs[Get Notification Preferences from DB]
  checkPlan[Check Billing Plan]

  input --> fetchPrefs --> checkPlan

  checkPlan -->|free| emailOnly[Only Send Email]
  checkPlan -->|paid| dispatch[Dispatch via Enabled Channels]

  dispatch --> Email
  dispatch --> Push
  dispatch --> Webhook
  dispatch --> Signal
  dispatch --> WhatsApp
  dispatch --> Telegram
  dispatch --> Slack
  dispatch --> Matrix

  Email[sendEmail]
  Push[sendPushNotification]
  Webhook[sendWebHookNotification]
  Signal[sendSignalNotification]
  WhatsApp[sendWhatsAppNotification]
  Telegram[sendTelegramNotification]
  Slack[sendSlackNotification]
  Matrix[sendMatrixNotification]
```
---

### Stripe Billing Lifecycle

```mermaid
sequenceDiagram
  autonumber
  participant User
  participant UI
  participant Checkout as checkout-session
  participant Stripe
  participant Webhook as stripe-webhook
  participant Supabase as DB
  participant Notifier as send-notification

  User->>UI: Clicks Upgrade
  UI->>Checkout: POST with userId + productId
  Checkout->>Stripe: Create Checkout Session
  Stripe-->>UI: Redirect URL
  Stripe->>Webhook: Triggers invoice.paid or subscription.created
  Webhook->>Supabase: Update billing record
  Webhook->>Notifier: Send confirmation email
```

---

### Cron Schedules

```mermaid
graph TB
  Cron1[04:00 Daily - Domain Updates] --> Trigger(trigger-updates)
  Cron2[Hourly - Website Monitor] --> Monitor(website-monitor)

  Trigger --> Updater(domain-updater)
  Monitor --> DB[Supabase DB Insert Uptime]
```

---

### Environmental Config

```mermaid
flowchart LR
subgraph Supabase
DB_URL
DB_KEY
end
subgraph Auth
GOOGLE_ID
GOOGLE_SECRET
GITHUB_ID
GITHUB_SECRET
FACEBOOK_ID
FACEBOOK_SECRET
end
subgraph Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_HM
STRIPE_PRICE_HA
STRIPE_PRICE_PM
STRIPE_PRICE_PA
end
subgraph ExternalAPIs
AS93_DOMAIN_INFO_URL
AS93_DOMAIN_INFO_KEY
AS93_SPONSORS_API
end
subgraph Notifications
RESEND_API_KEY
RESEND_SENDER
TWILIO_SID
TWILIO_AUTH_TOKEN
TELEGRAM_BOT_TOKEN
end
subgraph Workers
WORKER_DOMAIN_UPDATER_URL
WORKER_SEND_NOTIFICATION_URL
end
```

---

### Support for Supabase
We can not provide support for this codebase. It is provided as-is.
If you need help, please refer to the official docs for the services used.
We are not accepting feature requests or bug reports (except security issues) either.

The difficulty of deploying this project is graded at moderate to hard
You'll need a solid understanding of Deno, Supabase, Postgres and Docker

It is also possible to run Domain Locker without Supabase, using SQLite or Postgres, which is recommended.

