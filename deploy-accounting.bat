@echo off
cd /d "C:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
echo === Git Add and Commit ===
git add .
git commit -m "fix(accounting-fullwidth-and-pure-arabic): expand accounting page to 100%% full width, permanently purge global scope banner and PWA banner from layout, translate all accounting tabs/P&L table into 100%% pure Arabic, and verify Sun/Moon toggle"
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
