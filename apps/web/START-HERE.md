# Start the app

**Project folder & Git fix:** see [../DEV.md](../DEV.md) at repo root (folder path, index.lock fix, run dev).

---

## If port 3011 is in use (EADDRINUSE)

**Option 1 – Free the port, then start (PowerShell):**
```powershell
Get-NetTCPConnection -LocalPort 3011 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
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

**http://localhost:3011**

You should see the HelpHub homepage (or login).

If you see a blank white page, try:
- **http://localhost:3011/api/health** — should show `OK HelpHub` (confirms server is running)
- Hard refresh: **Ctrl+Shift+R**
