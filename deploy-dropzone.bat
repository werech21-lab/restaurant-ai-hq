@echo off
cd /d "C:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
git add .
git commit -m "fix(smart-dropzone-fullwidth-and-pure-arabic): force 100% full-width on smart dropzone page, permanently purge scope banner and PWA banner, and translate upload buttons into 100% pure Arabic"
git push origin main
npx.cmd vercel --prod --yes
