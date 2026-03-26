# Run from repo root: .\apps\web\run-dev.ps1
# Or from this folder: .\run-dev.ps1
Set-Location $PSScriptRoot
Write-Host "Starting Next.js on http://localhost:3006 ..." -ForegroundColor Green
npm run dev
