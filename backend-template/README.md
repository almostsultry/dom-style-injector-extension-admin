# DOM Style Injector Backend Service

Secure backend service for handling sensitive operations that require API secrets.

## Quick Start

### Development Setup

1. **Clone and setup environment:**
   ```bash
   cd backend-template
   cp .env.example .env
   # Edit .env with your development values
   ```

2. **Start development environment:**
   ```bash
   make dev
   # or
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
   ```

3. **Access services:**
   - Backend API: http://localhost:3000
   - Redis Commander: http://localhost:8081
   - PostgreSQL (Adminer): http://localhost:8080
   - Mailhog (email testing): http://localhost:8025

### Production Deployment

1. **Build production image:**
   ```bash
   docker build -t dom-injector-backend:latest --target production .
   ```

2. **Run with production config:**
   ```bash
   make prod
   # or
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Nginx    │────▶│   Backend   │────▶│    Redis    │
│  (Reverse   │     │   (Node.js) │     │   (Cache)   │
│   Proxy)    │     │             │     └─────────────┘
└─────────────┘     │             │
                    │             │     ┌─────────────┐
                    │             │────▶│  PostgreSQL │
                    │             │     │ (Database)  │
                    └─────────────┘     └─────────────┘
```

## Environment Variables

### Required for Production

```bash
# Azure AD (Confidential Client)
AZURE_CLIENT_ID=your-app-client-id
AZURE_CLIENT_SECRET=your-app-client-secret
AZURE_TENANT_ID=your-tenant-id

# License Configuration
LICENSE_SKU_ID=your-sku-from-partner-center
LICENSE_SERVICE_PLAN_ID=your-service-plan-id

# Extension
EXTENSION_ID=your-chrome-extension-id

# Security
JWT_SECRET=your-jwt-secret
REDIS_PASSWORD=strong-redis-password
POSTGRES_PASSWORD=strong-postgres-password
```

### Optional

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis
REDIS_URL=redis://default:password@host:port

# Monitoring
SENTRY_DSN=your-sentry-dsn
LOG_LEVEL=info
```

## API Endpoints

### Health Check
```bash
GET /health
```

### License Validation
```bash
POST /api/license/validate
Headers:
  Authorization: Bearer <user-token>
  Content-Type: application/json
Body:
  {
    "tenantId": "tenant-id"
  }
```

### Token Exchange
```bash
POST /api/auth/exchange
Headers:
  Authorization: Bearer <user-token>
Body:
  {
    "resource": "https://graph.microsoft.com"
  }
```

## Development

### Running Tests
```bash
make test
# or
docker-compose exec backend npm test
```

### Database Migrations
```bash
make db-migrate
# or
docker-compose exec backend npm run migrate
```

### Viewing Logs
```bash
make logs
# or
docker-compose logs -f backend
```

### Shell Access
```bash
make shell
# or
docker-compose exec backend sh
```

## Deployment Options

### 1. Docker Swarm
```bash
docker stack deploy -c docker-compose.yml -c docker-compose.prod.yml dom-injector
```

### 2. Kubernetes
```bash
# Convert docker-compose to k8s manifests
kompose convert -f docker-compose.yml -f docker-compose.prod.yml

# Apply manifests
kubectl apply -f .
```

### 3. Azure Container Instances
```bash
# Push to Azure Container Registry
az acr build --registry myregistry --image dom-injector-backend .

# Deploy to ACI
az container create \
  --resource-group myResourceGroup \
  --name dom-injector-backend \
  --image myregistry.azurecr.io/dom-injector-backend \
  --environment-variables-file .env.production
```

### 4. AWS ECS
```bash
# Build and push to ECR
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
docker build -t dom-injector-backend .
docker tag dom-injector-backend:latest $ECR_URI/dom-injector-backend:latest
docker push $ECR_URI/dom-injector-backend:latest

# Deploy with ECS CLI
ecs-cli compose --file docker-compose.yml --file docker-compose.prod.yml up
```

## Security Considerations

1. **Never commit .env files** - Use secrets management
2. **Use HTTPS in production** - Configure SSL certificates
3. **Implement rate limiting** - Already configured in nginx
4. **Regular security updates** - Update base images monthly
5. **Monitor logs** - Set up centralized logging

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Verify environment variables
docker-compose exec backend env | grep AZURE
```

### Database connection issues
```bash
# Test connection
docker-compose exec backend npm run db:test

# Check PostgreSQL logs
docker-compose logs postgres
```

### Redis connection issues
```bash
# Test Redis connection
docker-compose exec redis redis-cli ping

# Check Redis logs
docker-compose logs redis
```

## Monitoring

### Health Checks
- Backend: http://localhost:3000/health
- Redis: `redis-cli ping`
- PostgreSQL: `pg_isready`

### Recommended Monitoring Stack
- Prometheus for metrics
- Grafana for visualization
- Loki for log aggregation
- Alertmanager for alerts

## Support

For issues or questions:
1. Check logs: `make logs`
2. Review environment variables
3. Ensure all services are running: `make ps`
4. Check Docker resources: `docker system df`