@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo   Delta Force Armor Cloud - Update Push
echo ==========================================
echo.

git add -A

git diff --cached --quiet
if %errorlevel%==0 (
    echo No changes detected. Nothing to push.
    echo.
    pause
    exit /b 0
)

git commit -m "update %DATE% %TIME%"

echo.
echo Pushing to GitHub...
git push

echo.
echo ------------------------------------------
echo Done. Repo: https://github.com/qingling66666/delta-force-armor-cloud
echo ------------------------------------------
echo.
pause
