# VPS Monitor - Real-time System Dashboard

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/Oracle_Cloud-ARM-F80000?style=for-the-badge&logo=oracle" alt="Oracle Cloud" />
</p>

A beautiful, real-time VPS monitoring dashboard with a modern green/white theme. Monitor your server's CPU, RAM, Network bandwidth, and track which IPs are consuming the most resources.

## ✨ Features

- **Real-time Monitoring**: Live updates via WebSocket connection
- **CPU Monitoring**: Overall usage, per-core statistics, load averages
- **Memory Monitoring**: RAM and swap usage with detailed breakdowns
- **Network Monitoring**: 
  - Upload/Download speeds
  - Total bandwidth consumed
  - Per-interface statistics
  - **IP Traffic Tracking**: See which IPs use the most bandwidth
  - Endpoint access tracking (IP:Port combinations)
- **Process Monitoring**: Top processes by CPU/Memory usage
- **Beautiful UI**: Modern green/white theme with glass morphism effects
- **Responsive Design**: Works on desktop, tablet, and mobile

## 📸 Screenshots

The dashboard features:
- Overview tab with real-time charts
- Network tab with IP traffic analysis
- Processes tab showing resource-heavy processes

## 🏗️ Architecture

```
┌─────────────────┐     WebSocket     ┌─────────────────┐
│                 │◄──────────────────│                 │
│  Next.js        │                   │  FastAPI        │
│  Frontend       │     REST API      │  Backend        │
│  (Port 3000)    │◄──────────────────│  (Port 3001)    │
│                 │                   │                 │
└─────────────────┘                   └─────────────────┘
                                              │
                                              ▼
                                      ┌─────────────────┐
                                      │  System Metrics │
                                      │  (psutil)       │
                                      └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git
- Oracle Cloud ARM Ubuntu VPS (or any Linux server)

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/vps-monitor.git
   cd vps-monitor
   ```

2. **Configure environment variables** (Optional)
   ```bash
   # Create .env file for production
   cp .env.example .env
   # Edit with your domain settings
   nano .env
   ```

3. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d --build
   ```

4. **Access the dashboard**
   - Open `http://your-server-ip:3000` in your browser

### Option 2: Manual Installation

#### Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the backend (requires sudo for network stats)
sudo python main.py
# Or with uvicorn
sudo uvicorn main:app --host 0.0.0.0 --port 3001
```

#### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Start the server
npm start
```

## 🔧 Configuration with Nginx Proxy Manager

Since ports 80, 443, 8000, and 8080 are already in use, we'll use Nginx Proxy Manager to set up a reverse proxy.

### Step 1: Add Proxy Host for Frontend

1. Open your Nginx Proxy Manager admin panel
2. Go to **Proxy Hosts** → **Add Proxy Host**
3. Configure:
   - **Domain Names**: `monitor.yourdomain.com` (or your subdomain)
   - **Scheme**: `http`
   - **Forward Hostname/IP**: `localhost` (or your server IP)
   - **Forward Port**: `3000`
   - **Websockets Support**: ✅ Enable

4. SSL Tab:
   - **SSL Certificate**: Request a new SSL certificate
   - **Force SSL**: ✅ Enable
   - **HTTP/2 Support**: ✅ Enable

### Step 2: Add Proxy Host for Backend API

1. Add another Proxy Host:
   - **Domain Names**: `monitor-api.yourdomain.com`
   - **Scheme**: `http`
   - **Forward Hostname/IP**: `localhost`
   - **Forward Port**: `3001`
   - **Websockets Support**: ✅ Enable (Important for real-time updates!)

2. Enable SSL as above

### Step 3: Update Frontend Environment

After setting up the proxy, update the environment variables:

```bash
# In docker-compose.yml or .env file
API_URL=https://monitor-api.yourdomain.com
WS_URL=wss://monitor-api.yourdomain.com
```

Rebuild the frontend:
```bash
docker-compose up -d --build frontend
```

## 📁 Project Structure

```
vps-monitor/
├── backend/
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── Dockerfile          # Backend container config
├── frontend/
│   ├── app/
│   │   ├── page.tsx        # Main dashboard page
│   │   ├── layout.tsx      # Root layout
│   │   └── globals.css     # Global styles
│   ├── package.json        # Node.js dependencies
│   ├── tailwind.config.js  # Tailwind CSS config
│   ├── next.config.js      # Next.js config
│   └── Dockerfile          # Frontend container config
├── docker-compose.yml      # Docker Compose config
├── docker-compose.prod.yml # Production config
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/stats` | GET | All system statistics |
| `/api/cpu` | GET | CPU usage details |
| `/api/memory` | GET | Memory usage details |
| `/api/network` | GET | Network stats + IP traffic |
| `/api/disk` | GET | Disk usage details |
| `/api/processes` | GET | Top processes |
| `/ws` | WebSocket | Real-time stats stream |

## 🔒 Security Considerations

1. **Run behind a reverse proxy**: Always use Nginx Proxy Manager with SSL
2. **Firewall rules**: Only expose ports 3000 and 3001 to your proxy
3. **Authentication**: Consider adding basic auth in Nginx Proxy Manager
4. **Network permissions**: The backend requires elevated permissions to read network stats

### Adding Basic Authentication (Nginx Proxy Manager)

1. Go to your Proxy Host
2. Click **Edit**
3. Go to **Custom locations** tab
4. Add location `/` with Authentication enabled

## 🐛 Troubleshooting

### WebSocket Connection Failed
- Ensure WebSocket support is enabled in Nginx Proxy Manager
- Check that the backend is running: `docker logs vps-monitor-backend`
- Verify firewall allows port 3001

### No Network Stats
- The backend needs to run with elevated permissions
- Use `privileged: true` in docker-compose.yml
- Or run with `sudo` when running manually

### ARM-specific Issues (Oracle Cloud)
The Docker images are built for multi-arch. If you encounter issues:
```bash
docker-compose build --no-cache
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Next.js](https://nextjs.org/) - React framework
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Recharts](https://recharts.org/) - React charting library
- [psutil](https://psutil.readthedocs.io/) - System monitoring library

---

<p align="center">
  Made with ❤️ for VPS administrators
</p>
