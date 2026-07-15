# Production Deployment Guide

## Executive OS - Production Deployment

This guide covers deploying Executive OS to production environments (Linux/Kubernetes).

### Prerequisites

- Docker (v20.10+) and Docker Compose (v2.0+)
- PostgreSQL (v13+) or managed RDS
- Redis (v6+) or managed ElastiCache
- Python 3.11
- 2+ GB RAM, 10+ GB disk space
- SSL/TLS certificate (Let's Encrypt recommended)

### Quick Start (Docker Compose)

```bash
# 1. Clone repository
git clone https://github.com/diegorto/dashboardvivera.git
cd dashboardvivera

# 2. Copy environment configuration
cp .env.example .env

# 3. Update .env with your credentials
# Edit DATABASE_URL, PIPEDRIVE_API_TOKEN, ENCRYPTION_MASTER_KEY, etc.

# 4. Start services
docker-compose up -d

# 5. Verify health
curl http://localhost:8000/health
```

### Production Deployment Steps

#### 1. Database Setup

```bash
# PostgreSQL (managed RDS recommended for production)
createdb -U executive_os executive_os

# Initialize schema
psql -U executive_os -d executive_os -f migrations/init.sql

# Create indexes
psql -U executive_os -d executive_os -c "CREATE INDEX idx_audit_logs_batch ON audit_logs(batch_id)"
```

#### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://user:password@rds.amazonaws.com:5432/executive_os

# Security
ENCRYPTION_MASTER_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# API
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=false
LOG_LEVEL=INFO

# Optional: Redis for caching
REDIS_URL=redis://redis.elasticache.amazonaws.com:6379/0
```

#### 3. Docker Image Build

```bash
# Build image
docker build -t executive-os:latest .

# Tag for registry
docker tag executive-os:latest your-registry/executive-os:latest

# Push to registry
docker push your-registry/executive-os:latest
```

#### 4. Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace executive-os

# Create secrets
kubectl create secret generic executive-os-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=encryption-key="..." \
  -n executive-os

# Apply deployment
kubectl apply -f k8s/deployment.yaml -n executive-os
kubectl apply -f k8s/service.yaml -n executive-os
kubectl apply -f k8s/ingress.yaml -n executive-os

# Check rollout
kubectl rollout status deployment/executive-os -n executive-os
```

#### 5. SSL/TLS Configuration

```bash
# Using Let's Encrypt with Certbot
sudo certbot certonly --standalone -d executive-os.yourdomain.com

# Update .env
SSL_CERTFILE=/etc/letsencrypt/live/executive-os.yourdomain.com/fullchain.pem
SSL_KEYFILE=/etc/letsencrypt/live/executive-os.yourdomain.com/privkey.pem

# Auto-renewal
sudo systemctl enable certbot-renew.timer
```

#### 6. Monitoring & Logging

```bash
# Enable structured logging
LOG_LEVEL=INFO
SENTRY_DSN=https://your_key@sentry.io/project_id

# Container logging
docker logs -f executive_os_api

# Kubernetes logging
kubectl logs -f deployment/executive-os -n executive-os

# Metrics endpoint
curl http://localhost:8000/api/approval/statistics
```

#### 7. Health Checks & Monitoring

```bash
# API health
GET /health

# Approval queue stats
GET /api/approval/statistics

# Database connection pool stats (from logs)
# Metrics available via @track_performance decorator

# Set up monitoring alerts
# - API response time > 1s
# - Error rate > 5%
# - Database pool exhaustion
```

### Scaling Considerations

#### Horizontal Scaling

- Run multiple API instances behind load balancer
- Share PostgreSQL/Redis across instances
- Use StatelessORM approach (no local cache sharing)

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: executive-os-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: executive-os
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

#### Performance Tuning

- Connection pool: `POOL_SIZE=20, MAX_OVERFLOW=40`
- Cache TTL: 1 hour for fuzzy matching results
- Batch size: 100-500 items per batch
- Request timeout: 30 seconds

### Backup & Recovery

```bash
# PostgreSQL backup
pg_dump -U executive_os executive_os > backup.sql

# Kubernetes PV backup
kubectl exec -it postgres-pod -- pg_dump -U executive_os executive_os > backup.sql

# Restore
psql -U executive_os executive_os < backup.sql
```

### Troubleshooting

#### API connection issues
```bash
# Check database connectivity
docker exec executive_os_api python -c "from src.core.database import SessionLocal; SessionLocal()"

# Check Redis
redis-cli ping

# Check logs
docker logs executive_os_api | grep ERROR
```

#### Rate limiting triggered
```bash
# Check rate limiter state
curl -H "X-RateLimit-*" http://localhost:8000/api/approval/queue

# Adjust limits in .env
REQUESTS_PER_MINUTE=100
```

#### Slow queries
```bash
# Enable slow query log (PostgreSQL)
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

# Check metrics
curl http://localhost:8000/metrics
```

### Security Checklist

- [ ] HTTPS/TLS enabled (SSL_CERTFILE, SSL_KEYFILE)
- [ ] Database credentials in secrets (not in .env)
- [ ] API key authentication enabled (ENABLE_API_KEY_AUTH=true)
- [ ] Rate limiting enabled (ENABLE_RATE_LIMITING=true)
- [ ] Regular database backups scheduled
- [ ] Log aggregation configured (Sentry/CloudWatch)
- [ ] Firewall rules restrict database access
- [ ] Read-only replica for analytics queries
- [ ] Regular security updates applied

### Maintenance

```bash
# Check database
VACUUM ANALYZE;

# Cleanup old logs
DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

# Reset metrics
DELETE FROM sync_execution WHERE status='error';

# Update dependencies
pip install --upgrade -r requirements.txt
docker build --no-cache -t executive-os:latest .
```

### Support & Monitoring

- **Grafana Dashboards**: Monitor API response times, database pool usage
- **Prometheus Metrics**: Track operation durations, error rates
- **ELK Stack**: Aggregate and analyze logs
- **PagerDuty**: Alert on critical failures

For issues or support: diegoandreiaguiar@gmail.com
