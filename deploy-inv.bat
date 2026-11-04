@echo off
cd /d "c:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
git add .
git commit -m "fix(inventory-pure-arabic-and-export): enforce pure Arabic export button, page title metadata, batch labels, and search placeholder"
git push origin main
call npx.cmd vercel --prod --yes
