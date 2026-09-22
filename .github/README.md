<h1 align="center">Domain Locker</h1>
<p align="center">
	<i>The Central Hub for all your Domain Names</i>
  <br>
  <b>🌐<a href="https://domain-locker.com">domain-locker.com</a></b>
</p>
<p align="center">
  <img width="48" src="https://github.com/Lissy93/domain-locker/blob/main/src/assets/logo.png?raw=true" />
</p>

<!-- 
<p align="center">
  <a href="https://artifacthub.io/packages/helm/domain-locker/domain-locker">
    <img alt="ArtifactHub" src="https://img.shields.io/badge/-ArtifactHub-40b0c2?style=flat&logo=artifacthub&logoColor=ffffff" />
  </a>
  <a href="https://hub.docker.com/r/lissy93/domain-locker">
    <img alt="DockerHub" src="https://img.shields.io/docker/pulls/lissy93/domain-locker.svg?logo=docker&label=DockerHub&color=256bd7&labelColor=124ec9&logoColor=ffffff" />
  </a>
  <a href="https://apps.umbrel.com/app/domain-locker">
    <img alt="Umbrel" src="https://img.shields.io/badge/-Umbrel-7472fc?style=flat&logo=umbrel&logoColor=ffffff" />
  </a>
  <a href="https://community-scripts.github.io/ProxmoxVE/scripts?id=domain-locker">
    <img alt="Proxmox" src="https://img.shields.io/badge/-Proxmox-e57000?style=flat&logo=proxmox&logoColor=ffffff" />
  </a>
  <img alt="EasyPanel" src="https://img.shields.io/badge/-EasyPanel-15b7b1?style=flat&logo=qlty&logoColor=ffffff" />
  <img alt="Unraid" src="https://img.shields.io/badge/-Unraid-F15A2C?style=flat&logo=unraid&logoColor=ffffff" />
  <img alt="Portainer" src="https://img.shields.io/badge/-Portainer-13BEF9?style=flat&logo=portainer&logoColor=ffffff" />
</p>
-->

## About

The aim of Domain Locker, is to give you complete visibility of your domain name portfolio, in once central place.

For each domain you add, we analyse it and fetch all associated data. We then continuously monitor your domains, and notify you (according to your preferences) when something important changes or when it's soon to expire. So you'll get detailed domain analysis, security insights, change history, recent performance, valuation data and much more.

With Domain Locker, you'll never again loose track of your domains, miss an expiration, or forget which registrar and providers each domain uses.

### Screenshot

<p align="center">
<img width="800" src="https://cdn.as93.net/project-screens/domain-locker-homepage/w1024" />
</p>

<details>
<summary>More screenshots...</summary>
<p align="center"><sup>(Sorry about the 5fps, I wanted to keep file size down!)</sup></p>
<p align="center">
<img width="800" src="/.github/screenshots/quick-demo.gif" /><br>
<img width="800" src="/.github/screenshots/screenshot-grid.png" />
<img width="800" src="/.github/screenshots/domain-locker-viz-screenshots.png" />
<img width="800" src="/.github/screenshots/domain-locker-settings-screenshots.png" />
</p>
</details>


### Features

- 👁️ Total visibility of all your domains and upcoming expirations
- 📡 Auto-fetched data: SSL certs, hosts, registrars, IPs, subdomains, DNS, etc
- 🔬 View detailed metrics and analysis for each domain
- 📊 Visual analytics and breakdowns and trends across your portfolio
- 💬 Configurable alerts and webhook notifications
- 🗃️ Easy import/export, as well as API data access
- 📜 Track changes in domain configuration over time
- 📈 Monitor website health, security and performance
- 💹 Keep record of purchase prices and renewal costs
- 🔖 Add categories, and link related resources to domains
- 🎨 Multi-language support, dark/light/custom themes

<details>
<summary>More features...</summary>

```mermaid
%%{init: {"theme": "default"}}%%
kanban
    🌐 Domain Data
        🛰️ Auto-fetch assets: SSL, hosts, registrars, IPs, DNS, subdomains
        🔎 Detailed domain data like SSL, hosts, registrars, IPs and more
        🏷️ Enrich data with tags, notes, costs, and other metadata to track
        🖇️ Connection with external tools for more data
    📊 Metrics
        🗂️ Breakdown of domain providers: registrars, SSL, hosts
        🕒 Timeline of registrations and upcoming expirations
        📶 Monitor domain uptime, performance and health
        💹 Record valuation, purchase prices and renewal costs
    🔔 Notifications
        ⏱️ Get notified before your domain is due to expire
        📲 Configurable alerts for monitoring changes in domain config
        📬 Multiple channels: webhook, email, SMS, Slack, Telegram, WhatsApp and more
        🛤️ Track change history of each domain
    🛡️ Data
        💽 Own your data: Export, import, delte at any time
        ⌨️ Programatic access via a REST or GraphQL API, or with RSS, iCal, Prometheus integrations
        📈 Keep detailed change logs of all domain updates
        🔐 Transparent privacy policy
    🛠️ Customization
        👤 SSO and 2FA supported
        🎨 Custom themes, fonts, light/dark mode
        🌍 Multi-language support
        💻 Open-source and self-hostable
        ✅ Accessible, responsive, and well-documented
```

</details>

### Demo

Try the live demo to [demo.domain-locker.com](https://demo.domain-locker.com) <br>
(Username: `demo@domain-locker.com` Password: `domainlocker`)

---

## Get Started

To use Domain Locker, you have two options:
1. 💻 The managed instance, at **[domain-locker.com](https://domain-locker.com/)** _(free)_
2. 🏗️ Or **[self-hosting](#deployment)** yourself via Docker _(also free, ofc!)_

### Option 1: Domain-Locker.com
Head to [our website](https://domain-locker.com), and sign up with Google, GitHub or your email.<br>
The starter plan is free, and no setup is required. Just sign in, add your domains, and start tracking them.

### Option 2: Self-Hosting

```bash
docker run -p 3000:3000 -v domain-locker-data:/data lissy93/domain-locker
```

Or use the [`docker-compose.yml`](https://github.com/Lissy93/domain-locker/blob/main/docker-compose.yml)

<details>
	<summary>Details</summary>

 
- **Prerequisites**:
  - Domain Locker is intended to be run in a container, so you'll need Docker [installed](https://docs.docker.com/engine/install/) on your host system.
- **Containers**:
  - We have a Docker image published to [`lissy93/domain-locker`](https://hub.docker.com/r/lissy93/domain-locker).
  - That's all you need. Data is stored in a SQLite file, or in Postgres if you'd rather run one.
- **Environment**:
  - When starting the container, bind `3000` in the container, to your host `PORT` (defaults to `3000`).
  - Nothing else is required. For Postgres, also specify `DL_PG_HOST`, `DL_PG_PORT`, `DL_PG_USER`, `DL_PG_PASSWORD` and `DL_PG_NAME`.
- **Volumes**:
  - Mount a volume to `/data` to persist your data
- **Crons**
  - The app schedules these itself:
  - `/api/domain-updater` - Runs daily, to keep domain data up-to-date and trigger notifications
  - `/api/domain-monitor` - Runs every 15 minutes, to monitor website uptime and performance
  - `/api/cleanup-monitor-data` - Runs weekly, to aggregate old monitoring data
- **Example**:
  - Putting it all together, you can use our [`docker-compose.yml`](https://github.com/Lissy93/domain-locker/blob/main/docker-compose.yml) file.
  - For more details, view the [Self-Hosting Docs](https://domain-locker.com/about/self-hosting)

 
</details>


### Option 3: Unofficial Apps

- [![ArtifactHub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/domain-locker&color=40b0c2&labelColor=398c9a)](https://artifacthub.io/packages/helm/domain-locker/domain-locker)
- [![DockerHub](https://img.shields.io/docker/pulls/lissy93/domain-locker.svg?logo=docker&label=DockerHub&color=256bd7&labelColor=124ec9&logoColor=ffffff)](https://hub.docker.com/r/lissy93/domain-locker)
- [![Umbrel](https://img.shields.io/badge/Umbrel-domain_locker-7472fc?style=flat&logo=umbrel&labelColor=5351fb)](https://apps.umbrel.com/app/domain-locker)
- [![Supabase](https://img.shields.io/badge/Supabase-domain_locker-3FCF8E?style=flat&logo=supabase&labelColor=39ad79&logoColor=ffffff)](https://github.com/Lissy93/dl-sb-iac)
- [![Proxmox](https://img.shields.io/badge/Proxmox-domain_locker-e57000?style=flat&logo=proxmox&labelColor=cf6806&logoColor=ffffff)](https://community-scripts.github.io/ProxmoxVE/scripts?id=domain-locker)
- [![TrueNAS](https://img.shields.io/badge/TrueNAS-domain_locker-71BF44?style=flat&logo=truenas&labelColor=0095d5&logoColor=ffffff)](https://apps.truenas.com/catalog/domain-locker/)
- [![EasyPanel](https://img.shields.io/badge/EasyPanel-domain_locker-15b7b1?style=flat&logo=qlty&labelColor=06976c&logoColor=ffffff)](https://domain-locker.com/about/self-hosting/deploying-on-easypanel-io) _(Pending)_
- [![Unraid](https://img.shields.io/badge/Unraid-domain_locker-FF754B?style=flat&logo=unraid&labelColor=F15A2C&logoColor=ffffff)](https://domain-locker.com/about/self-hosting/deploying-on-unraid) _(Planned)_


---

## Developing

#### Project Setup

> See the [Developing Docs](https://domain-locker.com/about/developing) for more info

```bash
git clone git@github.com:Lissy93/domain-locker.git    # Get the code
cd domain-locker                                      # Navigate into directory
npm install --legacy-peer-deps                        # Install dependencies
cp .env.example .env                                  # Set environmental variables
npm run dev                                           # Start the dev server
```

---

## Attributions

##### Contributors

![contributors](https://readme-contribs.as93.net/contributors/lissy93/domain-locker)

##### Sponsors

![sponsors](https://readme-contribs.as93.net/sponsors/lissy93)

---

## License


> _**[Lissy93/Domain-Locker](https://github.com/Lissy93/domain-locker)** is licensed under [MIT](https://github.com/Lissy93/domain-locker/blob/HEAD/LICENSE) © [Alicia Sykes](https://aliciasykes.com) 2025._<br>
> <sup align="right">For information, see <a href="https://tldrlegal.com/license/mit-license">TLDR Legal > MIT</a></sup>

<details>
<summary>Expand License</summary>

```
The MIT License (MIT)
Copyright (c) Alicia Sykes <alicia@omg.com> 

Permission is hereby granted, free of charge, to any person obtaining a copy 
of this software and associated documentation files (the "Software"), to deal 
in the Software without restriction, including without limitation the rights 
to use, copy, modify, merge, publish, distribute, sub-license, and/or sell 
copies of the Software, and to permit persons to whom the Software is furnished 
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included install 
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANT ABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NON INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

</details>

<!-- License + Copyright -->
<p  align="center">
  <i>© <a href="https://aliciasykes.com">Alicia Sykes</a> 2025</i><br>
  <i>Licensed under <a href="https://gist.github.com/Lissy93/143d2ee01ccc5c052a17">MIT</a></i><br>
  <a href="https://github.com/lissy93"><img src="https://i.ibb.co/4KtpYxb/octocat-clean-mini.png" /></a><br>
  <sup>Thanks for visiting :)</sup>
</p>

<!-- Dinosaurs are Awesome -->
<!-- 
                        . - ~ ~ ~ ~ - .
      ..     _      .-~                 ~-.
     //|     \ `..~                        `.
    || |      }  }                /       \  \
(\   \\ \~^..'                   |         }  \
 \`.-~  o      /       }         |        /    \
 (__          |       /          |       /      `.
  `- - ~ ~ -._|      /_ - ~ ~ ~ ^|      /- _      `.
              |     /            |     /     ~-.     ~- _
              |_____|            |_____|         ~ - . _ _~_-_
-->
