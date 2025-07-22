# Makefile for DOM Style Injector Backend

.PHONY: help dev prod build clean logs test

# Default target
help:
	@echo "DOM Style Injector Backend - Docker Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-build    - Build and start development environment"
	@echo "  make logs         - View container logs"
	@echo "  make shell        - Open shell in backend container"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-build   - Build and start production environment"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run tests in container"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        - Stop and remove all containers"
	@echo "  make reset        - Clean + remove volumes (WARNING: deletes data)"
	@echo "  make ps           - Show running containers"

# Development commands
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

dev-build:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

dev-down:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml down

# Production commands
prod:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-build:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

prod-down:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Logging
logs:
	docker-compose logs -f backend

logs-all:
	docker-compose logs -f

# Shell access
shell:
	docker-compose exec backend sh

shell-redis:
	docker-compose exec redis redis-cli

shell-db:
	docker-compose exec postgres psql -U postgres -d dominjector

# Testing
test:
	docker-compose exec backend npm test

test-watch:
	docker-compose exec backend npm run test:watch

# Cleanup
clean:
	docker-compose down

reset:
	docker-compose down -v
	@echo "WARNING: All data has been deleted!"

# Status
ps:
	docker-compose ps

# Database operations
db-migrate:
	docker-compose exec backend npm run migrate

db-seed:
	docker-compose exec backend npm run seed

# Health check
health:
	@curl -f http://localhost:3000/health || echo "Backend is not healthy"