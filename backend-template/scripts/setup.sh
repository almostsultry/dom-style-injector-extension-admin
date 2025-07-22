#!/bin/bash
# Setup script for DOM Style Injector Backend

echo "🚀 Setting up DOM Style Injector Backend..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.development .env
    echo "✅ .env file created. Please update it with your values."
else
    echo "✅ .env file already exists."
fi

# Create required directories
echo "📁 Creating required directories..."
mkdir -p certs logs

# Generate self-signed certificates for local development
if [ ! -f certs/cert.pem ]; then
    echo "🔐 Generating self-signed certificates for development..."
    openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem \
        -days 365 -nodes -subj "/CN=localhost"
    echo "✅ SSL certificates generated."
else
    echo "✅ SSL certificates already exist."
fi

# Pull required Docker images
echo "🐳 Pulling Docker images..."
docker-compose pull

# Build the development image
echo "🔨 Building development Docker image..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml build

# Start the services
echo "🚀 Starting services..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🏥 Checking service health..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend service is healthy!"
else
    echo "⚠️  Backend service might still be starting. Check logs with: make logs"
fi

# Display service URLs
echo ""
echo "🎉 Setup complete! Services are available at:"
echo "   Backend API:    http://localhost:3000"
echo "   PostgreSQL:     http://localhost:8080 (Adminer)"
echo "   Mail Testing:   http://localhost:8025 (Mailhog)"
echo ""
echo "📚 Useful commands:"
echo "   make logs       - View logs"
echo "   make shell      - Open shell in backend container"
echo "   make test       - Run tests"
echo "   make clean      - Stop all services"
echo ""
echo "📖 Next steps:"
echo "   1. Update .env with your Azure AD credentials"
echo "   2. Run 'make dev' to start development"
echo "   3. Visit http://localhost:3000/health to verify"