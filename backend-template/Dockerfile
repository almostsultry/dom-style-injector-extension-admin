# Multi-stage Dockerfile for DOM Style Injector Backend
# Stage 1: Development
FROM node:18-alpine AS development

WORKDIR /app

# Install dependencies for development
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Expose port for development
EXPOSE 3000

# Development command with hot reload
CMD ["npm", "run", "dev"]

# Stage 2: Production Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY . .

# Stage 3: Production Runtime
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies and source from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/server.js ./
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Copy additional source files if you have them
# COPY --from=builder --chown=nodejs:nodejs /app/src ./src

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Production command
CMD ["node", "server.js"]