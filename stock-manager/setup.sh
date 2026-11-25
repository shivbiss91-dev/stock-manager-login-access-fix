#!/usr/bin/env bash
# ==============================================================================
# StockVista Automated Plain Server Setup Script
# Compatible with: Hostinger VPS / Ubuntu 22.04 & 24.04 LTS / Debian 11 & 12
# ==============================================================================

set -e

echo "=========================================================="
echo "  🚀 Starting StockVista Server Setup on Hostinger VPS"
echo "=========================================================="

# 1. Update system packages
echo "[1/6] Updating system packages..."
sudo apt update -y && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential ufw nginx

# 2. Install Node.js 22 LTS (Native node:sqlite DatabaseSync requires Node 22+)
echo "[2/6] Installing Node.js 22 LTS..."
if ! command -v node >/dev/null 2>&1 || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi

echo "  Node.js version: $(node -v)"
echo "  npm version:     $(npm -v)"

# 3. Install PM2 globally
echo "[3/6] Installing PM2 Process Manager..."
sudo npm install -g pm2

# 4. Install dependencies and build frontend
echo "[4/6] Installing project dependencies & building production bundle..."
npm ci
npm run build

# Ensure persistent SQLite directory exists
mkdir -p data

# 5. Start with PM2 and configure auto-restart on system reboot
echo "[5/6] Starting application with PM2 daemon..."
pm2 delete stockvista-server 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "Configuring PM2 startup script..."
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME || true

# 6. Configure UFW Firewall
echo "[6/6] Configuring UFW Firewall..."
sudo ufw allow OpenSSH || true
sudo ufw allow 80/tcp || true
sudo ufw allow 443/tcp || true
sudo ufw allow 3001/tcp || true
sudo ufw --force enable || true

echo "=========================================================="
echo "  ✅ StockVista is now running live!"
echo "  Port:            3001"
echo "  SQLite Database: ./data/stockvista.db"
echo "  Check status:    pm2 status"
echo "  View live logs:  pm2 logs stockvista-server"
echo "=========================================================="
