# Hadoop Cluster Sentiment Analyse
## Use Case: Sentiment Analysis with Apache Spark for Sentences in Game of Thrones 

## Prerequisites

### Software to install, for example with minikube on Ubuntu

- A installed docker engine https://docs.docker.com/engine/install/ubuntu/
- With optional setup for non-root user https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user

- A installed kubectl  https://kubernetes.io/de/docs/tasks/tools/install-kubectl/
- A installed minikube v1.13.0+ (with Kubernetes Server Version v1.19+) https://minikube.sigs.k8s.io/docs/start/
- A installed helm https://helm.sh/docs/intro/install/
- A installed Skaffold https://skaffold.dev/docs/install/

### startup
A running Kubernetes cluster with ingress, 

```bash
minikube start --driver=docker --memory 10240 --cpus 7
eval $(minikube docker-env)
minikube addons  enable ingress
```



A running Strimzi.io Kafka operator

```bash
helm repo add strimzi http://strimzi.io/charts/
helm install my-kafka-operator strimzi/strimzi-kafka-operator
```

A running Hadoop cluster with YARN (for checkpointing)

```bash
helm repo add stable https://kubernetes-charts.storage.googleapis.com/
helm install --namespace=default --set hdfs.dataNode.replicas=2 --set yarn.nodeManager.replicas=2 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
```

## Deploy

To develop using [Skaffold](https://skaffold.dev/), use `skaffold dev`. 


## Stop test

1. press `Strg+C` in terminal to stop skaffold
2. use `helm uninstall my-hadoop-cluster` to prevent hdfs id error on restart
