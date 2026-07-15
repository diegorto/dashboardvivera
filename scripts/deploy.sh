#!/bin/bash

# Vivera Dashboard - Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🚀 Starting deployment to $ENVIRONMENT..."
echo "📦 Timestamp: $TIMESTAMP"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

echo -e "${YELLOW}1/6 Pulling latest code...${NC}"
git fetch origin
git checkout main
git pull origin main

echo -e "${YELLOW}2/6 Building Docker images...${NC}"
docker-compose build --no-cache

echo -e "${YELLOW}3/6 Stopping old containers...${NC}"
docker-compose down || true

echo -e "${YELLOW}4/6 Starting containers...${NC}"
docker-compose up -d

echo -e "${YELLOW}5/6 Waiting for health checks...${NC}"
sleep 10

# Health check backend
if ! curl -f http://localhost:3001/api/governance/health &> /dev/null; then
    echo -e "${RED}❌ Backend health check failed${NC}"
    docker-compose logs backend
    exit 1
fi

# Health check frontend
if ! curl -f http://localhost:3000 &> /dev/null; then
    echo -e "${RED}❌ Frontend health check failed${NC}"
    docker-compose logs frontend
    exit 1
fi

echo -e "${YELLOW}6/6 Deployment verification${NC}"
docker-compose ps

echo -e "${GREEN}✅ Deployment to $ENVIRONMENT completed successfully!${NC}"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:3001/api"
echo "   Nginx: http://localhost"
