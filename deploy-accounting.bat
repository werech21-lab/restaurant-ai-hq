@echo off
cd /d "c:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
git add .
git commit -m "fix(accounting-fullwidth-and-permanent-header-purge): force 100% full-width on accounting page, permanently purge scope filter and PWA banner from global layout, and enforce 100% pure Arabic in accounting tabs and P&L table"
git push origin main
call npx.cmd vercel --prod --yes
