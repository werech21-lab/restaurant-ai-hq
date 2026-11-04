@echo off
cd /d "C:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
echo === Git Add and Commit ===
git add .
git commit -m "fix(inventory-complete-seed-kpis-and-folder-upload): fix empty inventory bug with 60+ real items seed, add 4 financial valuation KPIs, activate 4 tabs, fix folder upload dialog without accept, and set pure Arabic metadata"
if errorlevel 1 (
    echo Commit failed or nothing to commit
)
echo === Git Push Origin Main ===
git push origin main
if errorlevel 1 (
    echo Push failed
    exit /b 1
)
echo === Vercel Production Deploy ===
call npx.cmd vercel --prod --yes
if errorlevel 1 (
    echo Vercel deploy failed
    exit /b 1
)
echo === Deployment Succeeded ===
