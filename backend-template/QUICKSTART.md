# Quick Start Guide - Backend Service

This guide will get you up and running with the secure backend service in minutes.

## Prerequisites

- Docker Desktop installed ([Download](https://www.docker.com/products/docker-desktop))
- Git installed
- Azure AD tenant (free tier is fine)

## 5-Minute Setup

### 1. Initial Setup (2 minutes)

```bash
# Navigate to backend directory
cd backend-template

# Run automated setup
./scripts/setup.sh
```

This will:
- Create your .env file
- Generate SSL certificates
- Pull Docker images
- Start all services

### 2. Azure AD Setup (3 minutes)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
   - Name: `DOM Style Injector Backend (Dev)`
   - Supported account types: "Single tenant"
   - Click "Register"
4. Copy the Application (client) ID
5. Go to "Certificates & secrets" → "New client secret"
6. Copy the secret value

### 3. Configure Environment

Edit `.env` file with your values:

```bash
AZURE_CLIENT_ID=paste-your-client-id-here
AZURE_CLIENT_SECRET=paste-your-secret-here
AZURE_TENANT_ID=paste-your-tenant-id-here
```

### 4. Restart Services

```bash
make clean
make dev
```

## Verify Setup

1. **Check health endpoint:**
   ```bash
   curl http://localhost:3000/health
   ```
   Should return: `{"status":"healthy",...}`

2. **View logs:**
   ```bash
   make logs
   ```

3. **Access services:**
   - API: http://localhost:3000
   - Database UI: http://localhost:8080
   - Email testing: http://localhost:8025

## Common Commands

```bash
# Start services
make dev

# Stop services
make clean

# View logs
make logs

# Run tests
make test

# Access shell
make shell
```

## Development Workflow

1. **Make changes** to `server.js`
2. **Save file** - hot reload will restart the server
3. **Test endpoints** using curl or Postman
4. **Check logs** for errors: `make logs`

## Testing License Validation

```bash
# Get a user token from your extension first, then:
curl -X POST http://localhost:3000/api/license/validate \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "your-tenant-id"}'
```

## Troubleshooting

### Services won't start
```bash
# Check if ports are in use
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Reset everything
make reset
make dev
```

### Can't connect to backend
```bash
# Check if backend is running
docker ps

# Check backend logs
docker logs dom-injector-backend
```

### Database errors
```bash
# Access database shell
make shell-db

# Check tables
\dt

# Exit
\q
```

## Next Steps

1. **Update extension** to use `http://localhost:3000` as backend URL
2. **Test license validation** through the extension
3. **Deploy to staging** when ready
4. **Configure production** environment variables

## Need Help?

- Check logs first: `make logs`
- Review `.env` configuration
- Ensure Docker is running
- Check service health: `curl http://localhost:3000/health`