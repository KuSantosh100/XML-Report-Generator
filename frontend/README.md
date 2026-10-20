# SQA Report Studio — Frontend (GitHub Pages)

This is the static web interface for **SQA Report Studio**. It is ready to deploy directly to **GitHub Pages**.

---

## 🚀 Quick Deployment to GitHub Pages

### Method 1: Push `frontend` to a new GitHub Repository
1. Initialize git inside this `frontend` folder:
   ```bash
   cd frontend
   git init
   git add .
   git commit -m "Deploy SQA Report Studio Frontend"
   ```
2. Create a new repository on GitHub (e.g. `sqa-report-studio`).
3. Push to GitHub:
   ```bash
   git branch -M main
   git remote add origin https://github.com/<your-username>/sqa-report-studio.git
   git push -u origin main
   ```
4. On GitHub, go to:
   **Settings &rarr; Pages &rarr; Build and deployment**:
   - **Source**: `Deploy from a branch`
   - **Branch**: `main` / `/ (root)`
   - Click **Save**.
5. Your web app is live at `https://<your-username>.github.io/sqa-report-studio/`!

---

## 🔌 Connecting to Your Backend Docker VM

When you open your GitHub Pages site:
1. In the top navigation bar, click the **Server Connection button** (next to the theme toggle).
2. Enter your Docker Server VM address (for example: `http://192.168.1.100:1500` or `https://my-sqa-api.example.com`).
3. Click **Test Ping** to verify connectivity, then click **Save & Connect**.

---

## ⚠️ Important Note: HTTPS & Mixed Content

Because GitHub Pages runs on **HTTPS** (`https://...github.io`), modern web browsers block requests to plain **HTTP** IP addresses (`http://<vm-ip>:1500`) by default due to **Mixed Content security rules**.

To connect smoothly, choose one of these simple solutions:

### Option A: Free Cloudflare Tunnel or ngrok (Recommended for HTTPS)
Run Cloudflare Tunnel on your VM to get a free, secure HTTPS URL in 10 seconds:
```bash
# On your VM (or using Docker):
cloudflared tunnel --url http://localhost:1500
```
This gives you a secure URL like `https://random-name.trycloudflare.com` that connects to GitHub Pages without any browser warnings!

### Option B: Browser Permission (Fastest for Internal Use)
1. In your browser (Chrome / Edge / Brave), open your GitHub Pages site.
2. Click the **View Site Information** icon (tune / lock icon next to the address bar).
3. Go to **Site settings** &rarr; find **Insecure content** &rarr; change from *Block* to **Allow**.
4. Refresh the page. You can now connect directly to `http://<your-vm-ip>:1500`!
