@echo off
cd /d "c:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
git add .
git commit -m "fix(accounting-accuracy): compute dynamic AOV (167,092.160 / 18,141 = 9.211 KWD) and add exact P&L reconciliation table (42,441.480 KWD net profit after 124,650.680 KWD deductions)"
git push origin main
npx vercel --prod --yes
