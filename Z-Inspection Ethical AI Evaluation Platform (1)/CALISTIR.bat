@echo off
echo ========================================
echo Z-Inspection Uygulamasini Baslatma
echo ========================================
echo.

echo [1/2] Backend sunucusu baslatiliyor...
start "Backend Server" cmd /k "cd backend && node server.js"
timeout /t 3 /nobreak >nul

echo [2/2] Frontend sunucusu baslatiliyor...
start "Frontend Server" cmd /k "cd frontend && npm run dev"
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo Sunucular baslatildi!
echo ========================================
echo.
echo Backend:  http://127.0.0.1:5000
echo Frontend: http://localhost:3000
echo.
echo Sunuculari durdurmak icin terminal pencerelerini kapatin.
echo.
pause

