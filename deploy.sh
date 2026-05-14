#!/bin/bash
# SEO Command Center - Deployment Script
# Run this on your VPS after transferring the project

set -e

echo "=== SEO Command Center Deployment ==="

# 1. Install backend dependencies
echo "[1/6] Installing backend dependencies..."
cd backend && npm install --production && cd ..

# 2. Install crawler dependencies
echo "[2/6] Installing crawler dependencies..."
cd crawler && pip3 install -r requirements.txt && cd ..

# 3. Install Playwright browser for crawler
echo "[3/6] Installing Playwright browser..."
python3 -m playwright install chromium

# 4. Build frontend
echo "[4/6] Building frontend..."
cd frontend && npm install && npm run build && cd ..

# 5. Create logs directory
echo "[5/6] Creating logs directory..."
mkdir -p logs

# 6. Start with PM2
echo "[6/6] Starting services with PM2..."
pm2 delete seo-backend seo-crawler 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "=== Deployment Complete ==="
echo "Backend:  http://localhost:4800"
echo "Crawler:  http://localhost:4801"
echo ""
echo "Next steps:"
echo "  1. Copy nginx.conf to /etc/nginx/sites-available/seo-command-center"
echo "  2. ln -s /etc/nginx/sites-available/seo-command-center /etc/nginx/sites-enabled/"
echo "  3. Update server_name in nginx.conf to your domain"
echo "  4. Update CORS_ORIGIN in backend/.env to your domain"
echo "  5. nginx -t && systemctl reload nginx"
echo "  6. Set up SSL: certbot --nginx -d seo.yourdomain.com"
