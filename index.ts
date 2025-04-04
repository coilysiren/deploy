import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const name = "coilysiren-deploy";

// Create a GKE cluster without the default node pool
const cluster = new gcp.container.Cluster(name, {
  initialNodeCount: 1,
  removeDefaultNodePool: true,
});

// Explicitly create a node pool
const nodePool = new gcp.container.NodePool(`${name}-nodepool`, {
  cluster: cluster.name,
  nodeCount: 1,
  nodeConfig: {
    machineType: "e2-standard-2",
    oauthScopes: [
      "https://www.googleapis.com/auth/compute",
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring",
    ],
  },
});

// Export the Cluster name
export const clusterName = cluster.name;

// Manufacture a GKE-style kubeconfig. Note that this is slightly "different"
// because of the way GKE requires gcloud to be in the picture for cluster
// authentication (rather than using the client cert/key directly).
export const kubeconfig = pulumi
  .all([cluster.name, cluster.endpoint, cluster.masterAuth])
  .apply(([name, endpoint, masterAuth]) => {
    const context = `${gcp.config.project}_${gcp.config.zone}_${name}`;
    return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${masterAuth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: gke-gcloud-auth-plugin
      provideClusterInfo: true
`;
  });

// Create a Kubernetes provider instance that uses our cluster from above.
const clusterProvider = new k8s.Provider(name, {
  kubeconfig: kubeconfig,
});

// Create a Kubernetes Namespace
const namespace = new k8s.core.v1.Namespace(
  name,
  {},
  { provider: clusterProvider }
);

// Export the Namespace name
export const namespaceName = namespace.metadata.apply((meta) => meta.name);

// Create a NGINX Deployment
const appLabels = { appClass: name };
const deployment = new k8s.apps.v1.Deployment(
  name,
  {
    metadata: {
      namespace: namespaceName,
      labels: appLabels,
    },
    spec: {
      replicas: 1,
      selector: { matchLabels: appLabels },
      template: {
        metadata: {
          labels: appLabels,
        },
        spec: {
          containers: [
            {
              name: name,
              image: "nginx:latest",
              ports: [{ name: "http", containerPort: 80 }],
            },
          ],
        },
      },
    },
  },
  {
    provider: clusterProvider,
  }
);

// Export the Deployment name
export const deploymentName = deployment.metadata.apply((m) => m.name);

// Create a LoadBalancer Service for the NGINX Deployment
const service = new k8s.core.v1.Service(
  name,
  {
    metadata: {
      labels: appLabels,
      namespace: namespaceName,
    },
    spec: {
      type: "LoadBalancer",
      ports: [{ port: 80, targetPort: "http" }],
      selector: appLabels,
    },
  },
  {
    provider: clusterProvider,
  }
);

// Export the Service name and public LoadBalancer endpoint
export const serviceName = service.metadata.apply((m) => m.name);
export const servicePublicIP = service.status.apply(
  (status) => status.loadBalancer.ingress[0].ip
);
