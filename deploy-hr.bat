@echo off
cd /d "C:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
git add .
git commit -m "fix(hr-fullwidth-and-pure-arabic): force 100% full-width on HR page, permanently purge scope filter and PWA banner from global layout, translate all HR headers and employee cards into 100% pure Arabic, and verify Shyam replacement"
git push origin main
npx.cmd vercel --prod --yes
