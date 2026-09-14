---
slug: deploying-with-kubernetes-helm-charts
title: Kubernetes Deployment
description: How to deploy Domain Locker using Kubernetes and Helm charts
coverImage: 
index: 2
---


<blockquote class="markdown-alert markdown-alert-note">
Helm charts are provided for reference only, and are not officially supported.
Note that the chart still deploys Postgres alongside the app, rather than using SQLite.
If you encounter issues, please feel free to submit a pull request to improve the documentation or the charts.
</blockquote>

## Installation Prerequisites


### Install `kubctl`

```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
```

For instructions for your OS, see the [kubernetes docs](https://kubernetes.io/docs/tasks/tools/)

### Install `minikube`

```bash
curl -LO https://storage.googleapis.com/minikube/releases/latest/minikube_latest_amd64.deb
sudo dpkg -i minikube_latest_amd64.deb
```

For instructions for your OS, see the [minikube docs](https://minikube.sigs.k8s.io/docs/start)

### Install `helm`

```bash
curl -fsSL -o get_helm.sh https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3
chmod 700 get_helm.sh
./get_helm.sh
```

For instructions for your OS, see the [helm docs](https://helm.sh/docs/intro/install/)

---

## Start the app


### Start Kubernetes

```bash
minikube start
```

### Add the Helm repository

```bash
helm repo add domain-locker https://lissy93.github.io/domain-locker/helm
```


### Install the chart

```bash
helm install dl domain-locker/domain-locker --version 0.0.8
```

### Verify it's running

```bash
kubectl get all
```

### Port forward to access

```bash
kubectl port-forward svc/domain-locker-app 3000:80
```

### Launch the app

You should now be able to access Domain Locker at `localhost:3000` 🎉

---


## Debug


You can check the app is running with:

```bash
kubectl get pods
kubectl get svc
```

And view the logs with:

```bash
kubectl logs deploy/domain-locker-app
```

Or open a debug shell with:

```bash
kubectl exec -it deploy/domain-locker-app -- sh
```

Manually connect to the database:

```bash
psql -h domain-locker-postgres -U postgres -d domain_locker
```

[![Artifact Hub](https://img.shields.io/endpoint?url=https://artifacthub.io/badge/repository/domain-locker)](https://artifacthub.io/packages/search?repo=domain-locker)

---

## Manual Installation

You can also manually add the repo, from the source.
This is useful if you want to make any changes, or want to maintain your own fork.
The source for the helm charts is in the [`helm`](https://github.com/Lissy93/domain-locker/tree/main/helm) directory.

```bash
git clone git@github.com:Lissy93/domain-locker.git
cd domain-locker
helm install dl ./helm
```
