@echo off
cd /d "C:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
echo === Git Add and Commit ===
git add .
git commit -m "fix(purchases-fullwidth-and-global-header-purge): expand purchases page to 100%% width, remove all English strings/units (PO/CSV/3-Way/AP/kg/L) in Arabic mode, link real Odoo warehouse receivers, and permanently delete global scope bar & PWA banner"
if errorlevel 1 (
    echo Commit failed or nothing to commit
)
echo === Git Push Origin Main ===
git push origin main
if errorlevel 1 (
    echo Push failed, retrying once...
    timeout /t 2 /nobreak >nul
    git push origin main
    if errorlevel 1 (
        echo Push failed second time, proceeding with Vercel deploy first...
    )
)
echo === Vercel Production Deploy ===
call npx.cmd vercel --prod --yes
if errorlevel 1 (
    echo Vercel deploy failed
    exit /b 1
)
echo === Deployment Succeeded ===
