import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as simpleGit from "simple-git";

export = async () => {
  // Get repository name
  const git = simpleGit.default();
  const remote = (await git.getConfig("remote.origin.url")).value || "";
  const name = remote.split(":")[1].split(".")[0].replace("/", "-");

  // Create a GCP service account for general purpose use
  const account = new gcp.serviceaccount.Account("k8s", {
    accountId: `${gcp.config.project}-k8s`,
    displayName: "Kubernetes General Purpose Service Account",
  });

  new gcp.projects.IAMMember("k8s-artifact-registry-reader", {
    member: pulumi.interpolate`serviceAccount:${account.email}`,
    role: "roles/artifactregistry.reader",
    project: pulumi.interpolate`${account.project}`,
  });

  new gcp.projects.IAMMember("k8s-default-node-service-account", {
    member: pulumi.interpolate`serviceAccount:${account.email}`,
    role: "roles/container.defaultNodeServiceAccount",
    project: pulumi.interpolate`${account.project}`,
  });

  new gcp.projects.IAMMember("k8s-logs-writer", {
    member: pulumi.interpolate`serviceAccount:${account.email}`,
    role: "roles/logging.logWriter",
    project: pulumi.interpolate`${account.project}`,
  });

  // Create a GKE cluster without the default node pool
  const cluster = new gcp.container.Cluster(name, {
    initialNodeCount: 1,
    removeDefaultNodePool: true,
  });

  // Explicitly create a node pool
  new gcp.container.NodePool(`${name}-nodepool`, {
    cluster: cluster.name,
    nodeCount: 1,
    nodeConfig: {
      serviceAccount: pulumi.interpolate`${account.email}`,
      machineType: "e2-standard-2",
      oauthScopes: [
        "https://www.googleapis.com/auth/compute",
        "https://www.googleapis.com/auth/devstorage.read_only",
        "https://www.googleapis.com/auth/logging.write",
        "https://www.googleapis.com/auth/monitoring",
      ],
    },
  });
};
