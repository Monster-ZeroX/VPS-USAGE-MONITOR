# Nginx Proxy Manager Configuration Guide

## Overview

This guide shows you how to configure Nginx Proxy Manager to work with VPS Monitor.
Since you mentioned ports 80, 443, 8000, and 8080 are already in use, this assumes
you already have Nginx Proxy Manager running.

## Proxy Host Configuration

### Frontend Proxy (Dashboard)

Create a new Proxy Host with these settings:

```
Domain Names: monitor.yourdomain.com
Scheme: http
Forward Hostname / IP: 127.0.0.1
Forward Port: 3000
Cache Assets: ON
Block Common Exploits: ON
Websockets Support: ON (Important!)
```

#### Custom Nginx Configuration (Optional)
Add in the "Advanced" tab:

```nginx
# Increase timeouts for WebSocket connections
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;

# Additional WebSocket headers
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

### Backend API Proxy

Create another Proxy Host:

```
Domain Names: monitor-api.yourdomain.com
Scheme: http  
Forward Hostname / IP: 127.0.0.1
Forward Port: 3001
Cache Assets: OFF (Important - real-time data!)
Block Common Exploits: ON
Websockets Support: ON (Critical for live updates!)
```

#### Custom Nginx Configuration (Required)
Add in the "Advanced" tab:

```nginx
# WebSocket support is critical for real-time updates
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;

# Disable buffering for real-time data
proxy_buffering off;
proxy_cache off;

# Increase timeouts
proxy_read_timeout 86400s;
proxy_send_timeout 86400s;
proxy_connect_timeout 60s;

# Allow large responses
proxy_max_temp_file_size 0;
```

## SSL Configuration

For both proxy hosts:

1. Go to SSL tab
2. Select "Request a new SSL Certificate"
3. Enable "Force SSL"
4. Enable "HTTP/2 Support"
5. Enable "HSTS Enabled" (optional but recommended)

## Access List (Optional - Add Authentication)

If you want to add basic authentication:

1. Go to Access Lists in NPM
2. Create a new Access List
3. Add authorized users with passwords
4. Go back to your Proxy Hosts
5. Edit each one and select the Access List

## After Configuration

Update your `.env` file with the new URLs:

```env
API_URL=https://monitor-api.yourdomain.com
WS_URL=wss://monitor-api.yourdomain.com
```

Then rebuild the frontend:

```bash
docker-compose up -d --build frontend
```

## Troubleshooting

### WebSocket not connecting

1. Ensure "Websockets Support" is enabled in NPM
2. Check the custom nginx config is applied
3. Verify the backend is running: `docker logs vps-monitor-backend`

### 502 Bad Gateway

1. Check if containers are running: `docker-compose ps`
2. Check container logs: `docker-compose logs`
3. Verify the ports match (3000 for frontend, 3001 for backend)

### SSL Issues

1. Ensure your domain points to your server IP
2. Wait a few minutes for DNS propagation
3. Try forcing certificate renewal in NPM

### Real-time updates not working

1. Make sure to use `wss://` (with SSL) instead of `ws://` when using HTTPS
2. Check browser console for WebSocket errors
3. Verify the backend websocket endpoint: `wss://monitor-api.yourdomain.com/ws`
