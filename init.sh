#!/bin/bash
# ============================================
# Voost Level - Development Environment Setup
# ============================================
# This script initializes and runs the development environment
# for the Voost Level CRM application.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   Voost Level - Development Setup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check Node.js version
echo -e "${YELLOW}Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js version must be 18 or higher. Current: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}Node.js $(node -v) detected${NC}"

# Check npm
echo -e "${YELLOW}Checking npm...${NC}"
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}npm $(npm -v) detected${NC}"

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Setup Frontend
echo ""
echo -e "${YELLOW}Setting up frontend...${NC}"
cd frontend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    npm install
else
    echo -e "${GREEN}Frontend dependencies already installed${NC}"
fi

# Check for .env file
if [ ! -f ".env" ]; then
    echo -e "${RED}Warning: .env file not found in frontend directory${NC}"
    echo -e "${YELLOW}Please create .env with:${NC}"
    echo "  VITE_SUPABASE_URL=https://dsztivupnrzaxvrijxpu.supabase.co"
    echo "  VITE_SUPABASE_ANON_KEY=<your-anon-key>"
fi

cd ..

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "${BLUE}To start the development server:${NC}"
echo ""
echo "  cd frontend && npm run dev"
echo ""
echo -e "${BLUE}The application will be available at:${NC}"
echo ""
echo "  http://localhost:3000"
echo ""
echo -e "${BLUE}Technology Stack:${NC}"
echo "  - Frontend: React + Vite + Tailwind CSS"
echo "  - Backend:  Supabase (PostgreSQL + Auth + Realtime)"
echo "  - Project:  dsztivupnrzaxvrijxpu.supabase.co"
echo ""
echo -e "${YELLOW}Note: Backend is serverless via Supabase - no local setup needed.${NC}"
echo ""

# Optional: Start the development server
if [ "$1" == "--start" ] || [ "$1" == "-s" ]; then
    echo -e "${BLUE}Starting development server...${NC}"
    cd frontend
    npm run dev
fi
