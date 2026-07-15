#!/bin/bash

# Vivera Dashboard - Local Setup Script

set -e

echo "🔧 Setting up Vivera Executive Dashboard..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✓ Node.js: $(node --version)"
echo "✓ npm: $(npm --version)"

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd backend
npm ci
cd ..

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
cd frontend
npm ci
cd ..

# Create .env files if they don't exist
if [ ! -f backend/.env ]; then
    echo ""
    echo "📝 Creating backend/.env..."
    cat > backend/.env << 'BACKEND_ENV'
NODE_ENV=development
PORT=3001
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:3000
BACKEND_ENV
fi

if [ ! -f frontend/.env ]; then
    echo ""
    echo "📝 Creating frontend/.env..."
    cat > frontend/.env << 'FRONTEND_ENV'
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_ENV=development
FRONTEND_ENV
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Start backend: cd backend && npm start"
echo "   2. Start frontend: cd frontend && npm start"
echo ""
echo "Or use Docker:"
echo "   docker-compose up"
