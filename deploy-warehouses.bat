@echo off
cd /d "C:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
echo === Git Add and Commit ===
git add .
git commit -m "fix(warehouses-fullwidth-and-10-locations): expand warehouses page to full screen width, enforce exact 10 active locations (Central Kitchen Qurain + 9 branches without Jahra), link real Odoo supervisors, and enforce 100% pure Arabic"
if errorlevel 1 (
    echo Commit failed or nothing to commit
)
echo === Git Push Origin Main ===
git push origin main
if errorlevel 1 (
    echo Push failed, retrying once in 2 seconds...
    timeout /t 2 /nobreak >nul
    git push origin main
    if errorlevel 1 (
        echo Push failed second time
        exit /b 1
    )
)
echo === Vercel Production Deploy ===
call npx.cmd vercel --prod --yes
if errorlevel 1 (
    echo Vercel deploy failed
    exit /b 1
)
echo === Deployment Succeeded ===
