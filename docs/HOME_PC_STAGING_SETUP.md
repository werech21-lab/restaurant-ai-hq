# تشغيل Aether BI من جهاز المنزل (Venture Foods)

هذا الملف **لا يحتوي أسراراً**. انسخ القيم من `.env.staging` المحلي في المكتب إلى ملف `.env.staging` على جهاز المنزل (الملف git-ignored).

## المفاتيح المطلوبة في `.env.staging`

- `DATABASE_URL` — اتصال Staging Postgres (`pikqnlzkoaxoxpahztvc`)
- `DATABASE_SSL` / `DATABASE_SSL_CA` إن وُجدا
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (إن كان التطبيق يحتاجه سيرفرياً)
- أي مفاتيح auth/session المستخدمة محلياً في المكتب

## أوامر بعد السحب من `origin/main`

```bash
cd restaurant-ai-hqw
npm ci
# ضع .env.staging من النسخة الآمنة لديك
node --env-file=.env.staging scripts/migrate.mjs --status --expect-host pikqnlzkoaxoxpahztvc
npm run typecheck
npm run dev -- -p 4020
```

افتح: `http://localhost:4020/erp/hr` و `http://localhost:4020/erp/aggregator-radar`.

## بيانات HR

ترقية موظفي أودو من الملف المحلي:

```bash
node --env-file=.env.staging scripts/seed-venture-hr-from-dump.mjs
```

المسار الافتراضي للملف: `C:/Users/sec/Downloads/venturefoods_odoo_cids1_dump.json` أو عيّن `VENTURE_ODOO_DUMP`.
