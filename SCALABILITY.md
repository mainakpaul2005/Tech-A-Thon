# NexaCity5G Scalability Strategy

This document outlines the architecture for scaling the platform to support multi-city deployments and millions of IoT devices.

## 1. Orchestration (Kubernetes)
The entire platform is containerized and ready for K8s deployment.
- **Microservices**: Can be horizontally scaled using Horizontal Pod Autoscalers (HPA) based on CPU/Memory or custom MQTT queue depth metrics.
- **Edge Regions**: Deploy "Edge Node" pods in regional clusters closer to physical sensor networks to maintain low latency.

## 2. Global MQTT Mesh
For multi-city support, we use a bridged broker architecture:
- Each city has a local **Mosquitto** or **EMQX** broker cluster.
- Regional brokers bridge "Critical" and "Aggregated" topics to a central **Cloud Broker** for global analytics.

## 3. Database Scaling
- **PostgreSQL**: Transition to **Citus** or **CockroachDB** for distributed SQL and spatial data sharding.
- **Redis**: Use Redis Cluster or **Amazon ElastiCache** for globally distributed caching.

## 4. Sample K8s Deployment
See `/k8s/deployment.yaml` for the standard pod definition and service discovery configuration.
