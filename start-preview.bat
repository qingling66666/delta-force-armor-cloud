@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=3210
echo.
echo   Delta Force Armor DB - local preview
echo   ------------------------------------------------
echo   This PC : http://127.0.0.1:%PORT%
echo   Same Wi-Fi phone: http://YOUR-LAN-IP:%PORT%
echo   (run ipconfig to find your LAN IP)
echo   Close this window to stop the server.
echo.
start "" http://127.0.0.1:%PORT%/armor.html
node server.js
pause
