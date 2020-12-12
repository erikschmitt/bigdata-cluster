# Hadoop Cluster Sentiment Analyse
## Use Case: Sentiment Analysis with Apache Spark for Sentences in Game of Thrones 

```json
{ 
	mission: "sts-10", 
	timestamp: 1604325221 
}
```

## Prerequisites

A running Kubernetes cluster with ingress, for example with minikube on Linux

```bash
minikube addons  enable ingress
minikube start --driver=docker --memory 10240 --cpus 7
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
