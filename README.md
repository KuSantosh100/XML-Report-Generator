# SQA Report Studio — Architecture & Deployment Guide

This project is divided into two independent, decoupled components:

```
AI Code/
├── frontend/             # 🌐 Static Client UI (Ready for GitHub Pages)
│   ├── index.html        # Modern Dark/Light UI, Orangish-Yellow & Blue Theme
│   ├── app.js            # Client logic with dynamic Backend URL switcher
│   ├── config.js         # Default frontend settings
│   ├── .nojekyll         # GitHub Pages Jekyll bypass flag
│   ├── logo_Type0_*.jpg  # Wonder Pharma default cover logo
│   └── README.md         # Step-by-step GitHub Pages deployment guide
│
├── backend/              # 🐳 Dockerized PDF Generation API (For Local VM / Server)
│   ├── server.js         # Express REST API (CORS enabled for GitHub Pages)
│   ├── webReportService.js # 2-Pass PDF generator with blank page filter
│   ├── default_report_configs.json # Bundled templates (Wonder Pharma Type 0, etc.)
│   ├── Dockerfile        # Container build definition
│   ├── docker-compose.yml# 1-command startup (docker compose up -d)
│   ├── app/              # Original organization engine modules
│   └── README.md         # Docker VM deployment instructions
│
└── sqa_automation-node/  # Original monolith package (preserved intact)
```

---

## 🚀 Deployment Overview

### 1. Frontend &rarr; GitHub Pages
1. Push the contents of the [`frontend`](file:///Users/santy-sqwikoon/AI%20Code/frontend) folder to your GitHub repository.
2. In your GitHub repo settings, enable **GitHub Pages** from the `main` branch root.
3. Open the web app on GitHub Pages and use the **Server Connection button** in the top navigation bar to enter your Docker VM's IP address.
*(See detailed steps in [`frontend/README.md`](file:///Users/santy-sqwikoon/AI%20Code/frontend/README.md))*

### 2. Backend &rarr; Local Docker Server VM
1. Copy the [`backend`](file:///Users/santy-sqwikoon/AI%20Code/backend) folder to your Docker VM.
2. Run:
   ```bash
   cd backend
   docker compose up -d --build
   ```
3. Your PDF generation engine is now running at `http://<your-vm-ip>:1500`!
*(See detailed steps in [`backend/README.md`](file:///Users/santy-sqwikoon/AI%20Code/backend/README.md))*

---

## ⚡ Running Locally for Testing
You can run both locally right now:

```bash
# Terminal 1: Start Backend API
cd backend
node server.js

# Terminal 2: Open Frontend (or browse to http://localhost:1500)
open frontend/index.html
```
