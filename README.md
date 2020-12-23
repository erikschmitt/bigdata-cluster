# Hadoop Cluster Sentiment Analyse
## Use Case: Sentiment Analysis with Apache Spark for Sentences in Game of Thrones 

This repository includes a Big-Data-Application where a CSV-File of spoken sentences in Game of Thrones enriched with Dummy-Sentiment-Values processed to a Node-JS Dashboard. The architecture is as following:
 - Kafka-Producer with kafka-python which extracts the relevant data and sends it to a Kafka-Cluster
 - Spark-Consumer with pyspark which gets the data from Kafka, enriches it with the Dummy-Sentiment-Values and puts the relevant ones into a mysql-database
 - A Node-JS-Webserver with connection to the database, cache-servers (memcached) and a load balancer to show the the sentiment-values by person and by season

Therefore the different microservices run in separate Docker-Containers and Pods

The deployment is built in the skaffold.yaml

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
helm repo add stable https://charts.helm.sh/stable
helm install --namespace=default --set hdfs.dataNode.replicas=2 --set yarn.nodeManager.replicas=2 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
```

## Deploy

To develop using [Skaffold](https://skaffold.dev/), use `skaffold dev`. 


## Stop test

1. press `Strg+C` in terminal to stop skaffold
2. use `helm uninstall my-hadoop-cluster` to prevent hdfs id error on restart
