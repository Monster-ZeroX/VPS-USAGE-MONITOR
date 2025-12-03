import asyncio
import json
import subprocess
import re
from datetime import datetime
from typing import Dict, List, Optional
from collections import defaultdict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import psutil

app = FastAPI(title="VPS Monitor API", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store connected websocket clients
connected_clients: List[WebSocket] = []

# Network tracking
previous_net_io = None
previous_time = None


def get_cpu_usage() -> Dict:
    """Get CPU usage statistics"""
    cpu_percent = psutil.cpu_percent(interval=0.1, percpu=True)
    cpu_freq = psutil.cpu_freq()
    
    return {
        "overall": psutil.cpu_percent(interval=0.1),
        "per_core": cpu_percent,
        "cores": psutil.cpu_count(logical=True),
        "physical_cores": psutil.cpu_count(logical=False),
        "frequency": {
            "current": cpu_freq.current if cpu_freq else 0,
            "min": cpu_freq.min if cpu_freq else 0,
            "max": cpu_freq.max if cpu_freq else 0,
        } if cpu_freq else None,
        "load_avg": list(psutil.getloadavg()) if hasattr(psutil, 'getloadavg') else [0, 0, 0]
    }


def get_memory_usage() -> Dict:
    """Get RAM usage statistics"""
    memory = psutil.virtual_memory()
    swap = psutil.swap_memory()
    
    return {
        "total": memory.total,
        "available": memory.available,
        "used": memory.used,
        "percent": memory.percent,
        "free": memory.free,
        "cached": getattr(memory, 'cached', 0),
        "buffers": getattr(memory, 'buffers', 0),
        "swap": {
            "total": swap.total,
            "used": swap.used,
            "free": swap.free,
            "percent": swap.percent
        }
    }


def get_network_usage() -> Dict:
    """Get network bandwidth statistics"""
    global previous_net_io, previous_time
    
    net_io = psutil.net_io_counters()
    current_time = datetime.now()
    
    # Calculate rates
    bytes_sent_rate = 0
    bytes_recv_rate = 0
    
    if previous_net_io and previous_time:
        time_diff = (current_time - previous_time).total_seconds()
        if time_diff > 0:
            bytes_sent_rate = (net_io.bytes_sent - previous_net_io.bytes_sent) / time_diff
            bytes_recv_rate = (net_io.bytes_recv - previous_net_io.bytes_recv) / time_diff
    
    previous_net_io = net_io
    previous_time = current_time
    
    # Get per-interface stats
    interfaces = {}
    for iface, stats in psutil.net_io_counters(pernic=True).items():
        interfaces[iface] = {
            "bytes_sent": stats.bytes_sent,
            "bytes_recv": stats.bytes_recv,
            "packets_sent": stats.packets_sent,
            "packets_recv": stats.packets_recv,
            "errors_in": stats.errin,
            "errors_out": stats.errout,
            "drops_in": stats.dropin,
            "drops_out": stats.dropout
        }
    
    return {
        "bytes_sent": net_io.bytes_sent,
        "bytes_recv": net_io.bytes_recv,
        "bytes_sent_rate": bytes_sent_rate,
        "bytes_recv_rate": bytes_recv_rate,
        "packets_sent": net_io.packets_sent,
        "packets_recv": net_io.packets_recv,
        "interfaces": interfaces
    }


def get_network_connections() -> List[Dict]:
    """Get active network connections with IP information"""
    connections = []
    
    try:
        for conn in psutil.net_connections(kind='inet'):
            if conn.status == 'ESTABLISHED' and conn.raddr:
                connections.append({
                    "local_address": f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                    "remote_address": f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                    "remote_ip": conn.raddr.ip if conn.raddr else None,
                    "remote_port": conn.raddr.port if conn.raddr else None,
                    "status": conn.status,
                    "pid": conn.pid,
                    "local_port": conn.laddr.port if conn.laddr else None
                })
    except (psutil.AccessDenied, psutil.NoSuchProcess):
        pass
    
    return connections


def get_ip_traffic_stats() -> List[Dict]:
    """Get network traffic statistics per IP using nethogs or ss"""
    ip_stats = defaultdict(lambda: {"bytes_in": 0, "bytes_out": 0, "connections": 0, "urls": []})
    
    try:
        # Get connections and aggregate by remote IP
        connections = get_network_connections()
        
        for conn in connections:
            if conn["remote_ip"]:
                ip = conn["remote_ip"]
                ip_stats[ip]["connections"] += 1
                if conn["remote_port"]:
                    port = conn["remote_port"]
                    url = f"{ip}:{port}"
                    if url not in ip_stats[ip]["urls"]:
                        ip_stats[ip]["urls"].append(url)
        
        # Try to get bandwidth per connection using iftop or nethogs data
        # This is a simplified version - for more accurate data, nethogs would need to run as a service
        try:
            result = subprocess.run(
                ["ss", "-tn", "-o", "state", "established"],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            # Parse ss output for connection info
            for line in result.stdout.strip().split('\n')[1:]:
                parts = line.split()
                if len(parts) >= 5:
                    try:
                        recv_q = int(parts[1]) if parts[1].isdigit() else 0
                        send_q = int(parts[2]) if parts[2].isdigit() else 0
                        peer = parts[4]
                        
                        if ':' in peer:
                            ip = peer.rsplit(':', 1)[0].strip('[]')
                            ip_stats[ip]["bytes_in"] += recv_q
                            ip_stats[ip]["bytes_out"] += send_q
                    except (ValueError, IndexError):
                        continue
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
            
    except Exception as e:
        print(f"Error getting IP traffic stats: {e}")
    
    # Convert to list and sort by connections
    result = []
    for ip, stats in ip_stats.items():
        result.append({
            "ip": ip,
            "bytes_in": stats["bytes_in"],
            "bytes_out": stats["bytes_out"],
            "connections": stats["connections"],
            "urls": stats["urls"][:10]  # Limit URLs
        })
    
    return sorted(result, key=lambda x: x["connections"], reverse=True)[:50]


def get_disk_usage() -> List[Dict]:
    """Get disk usage statistics"""
    disks = []
    
    for partition in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(partition.mountpoint)
            disks.append({
                "device": partition.device,
                "mountpoint": partition.mountpoint,
                "fstype": partition.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": usage.percent
            })
        except (PermissionError, OSError):
            continue
    
    return disks


def get_system_info() -> Dict:
    """Get general system information"""
    boot_time = datetime.fromtimestamp(psutil.boot_time())
    uptime = datetime.now() - boot_time
    
    return {
        "hostname": subprocess.getoutput("hostname"),
        "platform": subprocess.getoutput("uname -sr") if subprocess.getstatusoutput("uname")[0] == 0 else "Linux",
        "boot_time": boot_time.isoformat(),
        "uptime_seconds": uptime.total_seconds(),
        "uptime_formatted": str(uptime).split('.')[0]
    }


def get_top_processes() -> List[Dict]:
    """Get top processes by CPU and memory usage"""
    processes = []
    
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'status']):
        try:
            pinfo = proc.info
            processes.append({
                "pid": pinfo['pid'],
                "name": pinfo['name'],
                "cpu_percent": pinfo['cpu_percent'] or 0,
                "memory_percent": pinfo['memory_percent'] or 0,
                "status": pinfo['status']
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    
    # Sort by CPU usage and return top 10
    return sorted(processes, key=lambda x: x['cpu_percent'], reverse=True)[:10]


@app.get("/")
async def root():
    return {"status": "ok", "message": "VPS Monitor API is running"}


@app.get("/api/stats")
async def get_all_stats():
    """Get all system statistics at once"""
    return {
        "timestamp": datetime.now().isoformat(),
        "cpu": get_cpu_usage(),
        "memory": get_memory_usage(),
        "network": get_network_usage(),
        "disk": get_disk_usage(),
        "system": get_system_info(),
        "connections": get_network_connections(),
        "ip_traffic": get_ip_traffic_stats(),
        "processes": get_top_processes()
    }


@app.get("/api/cpu")
async def api_cpu():
    return get_cpu_usage()


@app.get("/api/memory")
async def api_memory():
    return get_memory_usage()


@app.get("/api/network")
async def api_network():
    return {
        "usage": get_network_usage(),
        "connections": get_network_connections(),
        "ip_traffic": get_ip_traffic_stats()
    }


@app.get("/api/disk")
async def api_disk():
    return get_disk_usage()


@app.get("/api/system")
async def api_system():
    return get_system_info()


@app.get("/api/processes")
async def api_processes():
    return get_top_processes()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    connected_clients.append(websocket)
    
    try:
        while True:
            # Send stats every second
            stats = {
                "timestamp": datetime.now().isoformat(),
                "cpu": get_cpu_usage(),
                "memory": get_memory_usage(),
                "network": get_network_usage(),
                "ip_traffic": get_ip_traffic_stats(),
                "processes": get_top_processes()
            }
            
            await websocket.send_json(stats)
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        if websocket in connected_clients:
            connected_clients.remove(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
