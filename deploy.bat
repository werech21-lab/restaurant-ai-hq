@echo off
cd /d "C:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
git add .
git commit -m "fix(master-audit-polish): fix light mode text/card contrast globally, purge duplicate scope & PWA banners, reset localStorage scope filter, enforce 100% full-width layouts, fix folder Upload dialog, and complete 100% Arabic localization"
git push origin main
call npx.cmd vercel --prod --yes
