#!/bin/bash

# VPS Monitor Setup Script for Ubuntu (Oracle Cloud ARM)
# Run this script with: chmod +x setup.sh && sudo ./setup.sh

set -e

echo "=========================================="
echo "  VPS Monitor - Setup Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run this script as root (sudo ./setup.sh)${NC}"
    exit 1
fi

echo -e "${GREEN}[1/6] Updating system packages...${NC}"
apt-get update -y
apt-get upgrade -y

echo -e "${GREEN}[2/6] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Add current user to docker group
    usermod -aG docker $SUDO_USER || true
    
    # Enable and start Docker
    systemctl enable docker
    systemctl start docker
else
    echo "Docker is already installed."
fi

echo -e "${GREEN}[3/6] Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    apt-get install -y docker-compose-plugin
    # Also install standalone docker-compose
    curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose is already installed."
fi

echo -e "${GREEN}[4/6] Installing additional network tools...${NC}"
apt-get install -y net-tools iproute2 curl wget git

echo -e "${GREEN}[5/6] Configuring firewall (UFW)...${NC}"
if command -v ufw &> /dev/null; then
    # Allow SSH
    ufw allow 22/tcp
    # Allow VPS Monitor ports
    ufw allow 3000/tcp  # Frontend
    ufw allow 3001/tcp  # Backend API
    # Note: Don't enable ufw here as it might lock you out
    echo -e "${YELLOW}UFW rules added. Run 'sudo ufw enable' to activate.${NC}"
else
    echo "UFW not installed. Configure your firewall manually."
fi

echo -e "${GREEN}[6/6] Setting up VPS Monitor...${NC}"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env file from template."
fi

# Build and start containers
echo "Building and starting containers..."
docker-compose up -d --build

echo ""
echo "=========================================="
echo -e "${GREEN}  VPS Monitor Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Dashboard is now running at:"
echo -e "  ${GREEN}http://$(curl -s ifconfig.me):3000${NC}"
echo ""
echo "API is running at:"
echo -e "  ${GREEN}http://$(curl -s ifconfig.me):3001${NC}"
echo ""
echo "To view logs:"
echo "  docker-compose logs -f"
echo ""
echo "To stop the services:"
echo "  docker-compose down"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Configure Nginx Proxy Manager for your domain"
echo "2. Update .env with your domain URLs"
echo "3. Rebuild with: docker-compose up -d --build"
echo ""
