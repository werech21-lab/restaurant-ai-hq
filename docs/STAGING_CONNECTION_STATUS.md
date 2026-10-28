# حالة الربط المستضاف — Aether BI

التاريخ: 2026-10-28. الفرع: `cursor/erp-finance-inventory-crm`.

**CONNECTED.** جلسة PostgreSQL قراءة فقط نجحت على المشروع الحي، مع التحقق من شهادة TLS. لم تُطبَّق ترحيلات.

## الهوية

| البند | النتيجة |
| --- | --- |
| الملف | `restaurant-ai-hqw/.env.staging`، ومستبعد في `.gitignore` |
| `DATABASE_URL` | موجودة. المضيف `aws-0-ap-southeast-1.pooler.supabase.com`، المستخدم `postgres.pikqnlzkoaxoxpahztvc`، المنفذ `5432`، القاعدة `postgres` |
| `DATABASE_SSL` | `verify` |
| شهادة العميل | `authorized=true`، الاسم `*.pooler.supabase.com`، والجذر هو `Supabase Root 2021 CA` المطابق لشهادة Supabase العامة |
| `current_database()` | `postgres` |
| `current_user` / `session_user` | `postgres` (مجمع الجلسة يحوّل مستخدم المشروع إلى هذا الدور) |
| عنوان الخادم | `2406:da18:1248:be00::a7d3`، وهو عنوان `db.pikqnlzkoaxoxpahztvc.supabase.co` |
| الإصدار | PostgreSQL `17.11` |
| `pg_stat_ssl` | `ssl=false` على قفزة المجمع إلى القاعدة. إثبات TLS هو قفزة العميل إلى المجمع أعلاه |

الشهادة العامة حُفظت في `DATABASE_SSL_CA` داخل `.env.staging` فقط. بدونها يرفض `verify` السلسلة لأن جذر Supabase ليس في مخزن النظام. التحقق بقي مفعّلًا، ولم يُعطَّل `rejectUnauthorized`.

## ما داخل القاعدة

`schema_migrations` غير موجود. جداول `tenants` و`invoices` و`items` و`journal_entries` و`stock_movements` و`customers` و`suppliers` غير موجودة. عدد جداول `public` هو صفر. مخططات Supabase الافتراضية موجودة: `auth` و`storage` و`realtime` و`vault` وغيرها.

لا جداول ERP، لذلك لا سياسات RLS للتطبيق يمكن فحصها على المستضاف. الفحص المحلي السابق يبقى هو دليل RLS على الجهاز، وليس على هذه القاعدة.

## ما لم يُنفَّذ

نسخة فيزيائية مكتملة على المشروع بتاريخ `2026-10-28T09:56:53Z`، و`PITR` متوقف. لم تُنزَّل ولم تُستعد. `pg_dump` غير موجود على الجهاز. لم تُطبَّق ملفات `0001`–`0017`. قائمة السماح ما زالت المرجع الذي لا يُحل، فيرفض مشغّل الترحيل المشروع الحي قبل أي اتصال. لم يُعد تشغيل Vitest أو Playwright لأن شجرة المنتج لم تتغير.

## الحكم

**CONNECTED** للقراءة. **NO-GO** لكتابة الترحيلات حتى توجد نسخة قابلة للاستعادة وموافقة صريحة على تطبيق `0001`–`0017`.
