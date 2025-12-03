# Oracle Cloud ARM (Ampere A1) Specific Guide

## Overview

Oracle Cloud Free Tier provides up to 4 ARM-based Ampere A1 cores with 24GB RAM.
This guide covers specific considerations for running VPS Monitor on Oracle Cloud ARM Ubuntu.

## Instance Requirements

- **Shape**: VM.Standard.A1.Flex (ARM)
- **OS**: Ubuntu 22.04 or 24.04 (Canonical)
- **Minimum Resources**: 1 OCPU, 6GB RAM
- **Recommended**: 2 OCPU, 8GB RAM

## Security List Configuration

In Oracle Cloud Console, add these Ingress Rules:

| Source CIDR | Protocol | Destination Port | Description |
|-------------|----------|------------------|-------------|
| 0.0.0.0/0 | TCP | 3000 | VPS Monitor Frontend |
| 0.0.0.0/0 | TCP | 3001 | VPS Monitor Backend |

**Note**: If using Nginx Proxy Manager, you might already have 80/443 open.

## Network Configuration

Oracle Cloud has specific network security. Make sure to:

1. **Security List** (VCN level) - Add ingress rules as above
2. **Network Security Group** (Optional) - If using NSG, add similar rules
3. **Instance Firewall** (iptables/ufw) - Allow the ports

### Configure iptables (if UFW doesn't work)

```bash
sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 3001 -j ACCEPT
sudo netfilter-persistent save
```

## ARM-Specific Docker Notes

Docker images need to be built for ARM64. Our Dockerfiles are multi-arch compatible, but if you encounter issues:

```bash
# Force rebuild without cache
docker-compose build --no-cache

# Check architecture
uname -m  # Should show aarch64

# Verify Docker is using ARM
docker info | grep Architecture
```

## Performance Optimization

### 1. Swap Space

ARM instances benefit from swap:

```bash
# Create 4GB swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2. Docker Optimization

```bash
# Limit Docker logging
sudo nano /etc/docker/daemon.json
```

Add:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart Docker:
```bash
sudo systemctl restart docker
```

## Installation Steps

1. **SSH into your Oracle Cloud instance**
   ```bash
   ssh -i your-key ubuntu@your-instance-ip
   ```

2. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vps-monitor.git
   cd vps-monitor
   ```

3. **Run setup script**
   ```bash
   chmod +x setup.sh
   sudo ./setup.sh
   ```

4. **Verify services are running**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

5. **Access the dashboard**
   Open `http://your-instance-ip:3000` in your browser

## Telegram Bot Integration

If your Telegram bot is using significant bandwidth, you'll see it in the Network tab:
- The bot's API calls to `api.telegram.org` (IP: 149.154.xxx.xxx)
- File transfers will show as data to/from Telegram servers

Common Telegram IPs:
- 149.154.160.0/20
- 91.108.4.0/22

## Monitoring Your Telegram Bot

In the Network tab, look for connections to:
- `149.154.167.*` - Telegram Bot API
- `149.154.175.*` - Telegram file servers

The dashboard will show:
1. Connection count to Telegram servers
2. Data transferred
3. Access patterns

## Troubleshooting

### Docker fails to start

```bash
# Check Docker status
sudo systemctl status docker

# View Docker logs
sudo journalctl -u docker -f
```

### Can't access dashboard externally

1. Check Oracle Cloud Security List
2. Check instance firewall: `sudo iptables -L -n`
3. Verify containers: `docker-compose ps`

### High CPU from monitoring

The backend polls system stats every second. If this is too intensive:

Edit `backend/main.py`, find the WebSocket loop, and change:
```python
await asyncio.sleep(1)  # Change to 2 or 5 for less frequent updates
```

## Cost Considerations

VPS Monitor itself uses minimal resources:
- CPU: ~0.5-2% under normal operation
- RAM: ~200-400MB total (frontend + backend)
- Network: Minimal (only WebSocket data to your browser)

The monitoring overhead is negligible compared to the Telegram bot traffic.
