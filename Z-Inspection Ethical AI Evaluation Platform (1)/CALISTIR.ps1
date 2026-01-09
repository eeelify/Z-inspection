# Z-Inspection Uygulamasını Başlatma Script'i
# PowerShell Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Z-Inspection Uygulamasını Başlatma" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Backend sunucusunu başlat
Write-Host "[1/2] Backend sunucusu başlatılıyor..." -ForegroundColor Yellow
$backendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; node server.js" -PassThru
Start-Sleep -Seconds 3

# Frontend sunucusunu başlat
Write-Host "[2/2] Frontend sunucusu başlatılıyor..." -ForegroundColor Yellow
$frontendProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -PassThru
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Sunucular başlatıldı!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://127.0.0.1:5000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Sunucuları durdurmak için terminal pencerelerini kapatın." -ForegroundColor Yellow
Write-Host ""

