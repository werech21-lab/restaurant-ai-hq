@echo off
cd /d "c:\Users\hp\OneDrive\Desktop\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw"
git add .
git commit -m "fix(strict-real-data-and-crossfoot-math): eliminate estimated round numbers in heatmap matrix, enforce exact dynamic summation matching real Odoo totals (167,092.160 KWD sales and 51,154.950 KWD expenses), and add verified tfoot totals"
git push origin main
npx vercel --prod --yes
