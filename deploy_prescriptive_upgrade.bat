@echo off
cd /d "c:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
git add .
git commit -m "feat(prescriptive-bi): upgrade dashboard with dynamic math, interactive what-if decision simulator, executive action modal dispatch, and 5 departmental deep-dive tabs"
git push origin main
npx vercel --prod --yes
