# coilysiren deployment platform co

[Started with the Pulumi tutorial for GKE](https://www.pulumi.com/registry/packages/kubernetes/how-to-guides/gke/)

## Login

```bash
pulumi login
gcloud auth login
gcloud container clusters get-credentials \
    $(pulumi stack export | jq -r ".deployment.resources[0].outputs.clusterName") \
    --region=us-west2-a
```

```powershell
pulumi login
gcloud auth login
gcloud container clusters get-credentials `
  $(pulumi stack export | jq -r ".deployment.resources[0].outputs.clusterName") `
  --zone=us-west2-a
```

## Deploy

```bash
pulumi up
```
