# SQA Report Studio — Backend (Docker VM)

This is the Node.js PDF generation backend for **SQA Report Studio**. It is ready to run on any local Docker Server, VM, or VPS.

---

## 🚀 Running on Your Docker Server VM

### Method 1: Using Docker Compose (Recommended)
1. Copy this `backend` folder to your VM.
2. Inside the folder, run:
   ```bash
   docker compose up -d --build
   ```
3. Verify the container is running and healthy:
   ```bash
   docker ps
   curl http://localhost:1500/api/health
   ```
   You should see:
   ```json
   {"status":"ok","uptimeSeconds":10,"database":{"connected":true,...}}
   ```

### Method 2: Running with Node.js directly on your VM
If you prefer running without Docker:
```bash
npm install
node server.js
```

---

## 🌐 Connecting from GitHub Pages

When your frontend is hosted on **GitHub Pages**, it will connect to this backend at:
```
http://<YOUR_VM_IP_OR_HOSTNAME>:1500
```

### ⚠️ Note on HTTPS & Mixed Content:
Browsers accessing an HTTPS site (like GitHub Pages) will block HTTP requests to your VM by default.

To fix this easily:
1. **Option A (Cloudflare Tunnel - 100% Free & No Port Forwarding)**:
   ```bash
   # Install cloudflared on your VM
   cloudflared tunnel --url http://localhost:1500
   ```
   Cloudflare gives you an instant HTTPS address (e.g. `https://your-tunnel.trycloudflare.com`). Put this URL into the GitHub Pages Server Settings!
2. **Option B (Browser Exception)**:
   In your browser on GitHub Pages, go to Site Settings &rarr; set **Insecure Content** to **Allow**.
