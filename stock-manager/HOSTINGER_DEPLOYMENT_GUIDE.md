# 🚀 Hostinger Deployment & Server Setup Guide

This guide provides complete instructions to deploy **StockVista** (Frontend + SQLite Backend) on **Hostinger VPS (Plain Linux Server)** or **Hostinger hPanel (Node.js Hosting)**.

---

## 📋 Requirements
- **Node.js**: `v22.5.0` or higher (Node.js 22 LTS is required for built-in synchronous `node:sqlite`).
- **RAM**: Minimum 1 GB RAM (Hostinger KVM 1 VPS or above).
- **OS**: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, or Debian 12.

---

## 🛠️ Method 1: Hostinger VPS (Plain Linux Server) — Recommended

Hostinger VPS provides a plain Linux server with root SSH access.

### Step 1: Connect to your Hostinger VPS via SSH
From your terminal or PowerShell on your computer:
```bash
ssh root@YOUR_SERVER_IP
```

### Step 2: Clone the Project
```bash
cd /var/www
git clone https://github.com/shivbiss91-dev/stock-manager-login-access-fix.git stockvista
cd stockvista
```

### Step 3: Run the 1-Click Automated Setup
We have included `setup.sh` which automatically installs Node.js 22 LTS, PM2, Nginx, builds the project, and starts the service:
```bash
chmod +x setup.sh
./setup.sh
```

---

## 🔧 Method 2: Manual Step-by-Step on Hostinger VPS

If you prefer to configure each step manually:

### 1. Install Node.js 22 LTS & PM2
```bash
# Update repositories
sudo apt update -y && sudo apt upgrade -y

# Install Node.js 22 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential git ufw nginx

# Install PM2 Process Manager
sudo npm install -g pm2
```

### 2. Configure Environment & Build
```bash
cd /var/www/stockvista

# Copy production environment configuration
cp .env.production .env

# Install dependencies and build frontend
npm ci
npm run build

# Ensure SQLite data folder exists
mkdir -p data
```

### 3. Start Application with PM2
```bash
# Start via PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list so it automatically restarts on server reboots
pm2 save
pm2 startup
```

### 4. Configure Nginx Reverse Proxy
To connect your domain (e.g., `stock.yourdomain.com`) or server IP to port `3001`:

```bash
# Copy Nginx template
sudo cp nginx.conf /etc/nginx/sites-available/stockvista

# Edit the domain name in the file
sudo nano /etc/nginx/sites-available/stockvista
# Replace "yourdomain.com" with your actual domain or VPS IP

# Enable site
sudo ln -s /etc/nginx/sites-available/stockvista /etc/nginx/sites-enabled/

# Test configuration & restart Nginx
sudo nginx -t
sudo systemctl restart nginx
```

### 5. Add Free HTTPS / SSL with Certbot (Optional & Recommended)
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 🐳 Method 3: Deploy with Docker Compose on Hostinger VPS

If your Hostinger VPS has Docker installed:

```bash
cd /var/www/stockvista

# Build image and start in background
docker compose up -d --build

# View logs
docker compose logs -f
```
The SQLite database will be automatically persisted on your host inside `./data/stockvista.db`.

---

## 🌐 Method 4: Hostinger hPanel (Node.js Application Manager)

If you are using Hostinger Web/Cloud Hosting with the hPanel Node.js application feature:

1. Log in to **Hostinger hPanel**.
2. Navigate to **Websites** > **Dashboard** > **Advanced** > **Node.js**.
3. Click **Create Application**:
   - **Node.js version**: Choose `22.x`
   - **Application mode**: `Production`
   - **Application root**: `stockvista` (or `public_html`)
   - **Application startup file**: `server.js`
4. Upload project files (or clone via Git in hPanel).
5. In the hPanel terminal or file manager:
   - Run: `npm install`
   - Run: `npm run build`
6. Click **Restart Application** in hPanel.

---

## 🗄️ SQLite Database Location & Backups

- **Database File**: `/var/www/stockvista/data/stockvista.db`
- **Tables**:
  - `users`: Administrator credentials and user accounts.
  - `items`: Master inventory catalog.
  - `stock_movements`: Stock adjustment records and history.
  - `audit_logs`: Detailed calibration and operation audit trails.

### Download Backup via Browser:
- While logged in as Admin, navigate to **Settings / Backup** to download `stockvista.db` directly.
- Or copy it directly from the server:
  ```bash
  scp root@YOUR_SERVER_IP:/var/www/stockvista/data/stockvista.db ./my_backup.db
  ```

---

## 📋 Useful Server Management Commands

| Action | Command |
|---|---|
| Check app status | `pm2 status` |
| View live logs | `pm2 logs stockvista-server` |
| Restart server | `pm2 restart stockvista-server` |
| Stop server | `pm2 stop stockvista-server` |
| Check SQLite file size | `ls -lh /var/www/stockvista/data/stockvista.db` |
| Reload Nginx | `sudo systemctl reload nginx` |
