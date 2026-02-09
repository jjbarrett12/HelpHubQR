# Start the app

## If port 3010 is in use (EADDRINUSE)

**Option 1 – Free the port, then start (PowerShell):**
```powershell
Get-NetTCPConnection -LocalPort 3010 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
cd "c:\Users\jjbarrett\OneDrive - Bear Facility Supply\Desktop\HelpHubQR\apps\web"
npm run dev
```

**Option 2 – Use the script that frees the port and starts:**
```powershell
cd "c:\Users\jjbarrett\OneDrive - Bear Facility Supply\Desktop\HelpHubQR\apps\web"
npm run dev:fresh
```

**Option 3 – Close everything using the port:**  
Close any other terminal or Cursor window that might be running `npm run dev`, then run `npm run dev` again.

---

## Then open in the browser

**http://localhost:3010**

You should see a gray page with **HelpHub** and a **Go to login** button.

If you see a blank white page, try:
- **http://localhost:3010/api/health** — should show `OK HelpHub` (confirms server is running)
- Hard refresh: **Ctrl+Shift+R**
