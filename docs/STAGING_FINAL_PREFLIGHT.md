# الفحص الأخير قبل ترحيل Staging

التاريخ: 2026-10-28. الفرع: `cursor/erp-finance-inventory-crm`. المشروع الوحيد المقصود: `aether-bi-staging`، المرجع `pikqnlzkoaxoxpahtzvc`.

**القرار: الترحيل المستضاف غير جاهز للتنفيذ.** لم يُفتح اتصال، ولم يُطبَّق ترحيل، ولم يُؤخذ نسخ احتياطي. التوقف المتبقي هو إدخال كلمة مرور PostgreSQL الجديدة لهذا المشروع فقط، بعد أن يصبح اسم المضيف قابلاً للحل.

## 1. التقارير السابقة

قُرئت `docs/STAGING_ACTIVATION_REPORT.md` و`docs/STAGING_SECURITY_AUDIT.md` و`docs/ERP_E2E_TEST_RESULTS.md`. نتيجتها السابقة ما زالت سارية: التجربة المحلية نجحت، والاتصال المستضاف لم يُفتح، والمفتاح السري الذي ظهر في المحادثة مكشوف ولا يُستخدم.

## 2. الأسرار وGit

`.gitignore` يستبعد `.env` و`.env*.local` و`.env.staging` و`.env.production`. `git check-ignore` يؤكد الاستبعاد الأربعة. `git status` لا يُظهر `.env.staging`.

سطر `SUPABASE_SECRET_KEY` أُزيل من `.env.staging` دون طباعة قيمته. الملف المتبقي يحتوي عنوان المشروع والمفتاح القابل للنشر و`DATABASE_SSL=require`. لا يحتوي `DATABASE_URL`.

## 3 و4 و5. اتصال PostgreSQL

لا توجد سلسلة اتصال جديدة على الجهاز. `.env` و`.env.local` و`.env.production` غير موجودة، و`.env.staging` بلا `DATABASE_URL`. المفتاح السري السابق لم يُستخدم، وهو ليس كلمة مرور قاعدة البيانات.

الأسماء المطلوبة، بلا قيم، موجودة في `.env.staging.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL`
- `DATABASE_SSL=require`

الإدخال مرة واحدة، على هذا الجهاز فقط، داخل `.env.staging` الذي يتجاهله Git. لا تُلصق كلمة المرور في المحادثة. من لوحة المشروع `aether-bi-staging` انسخ سلسلة الاتصال المباشرة أو مجمع الجلسة، وتأكد أن المستخدم أو المضيف يحتوي `pikqnlzkoaxoxpahtzvc`. ألغِ المفتاح السري المكشوف من لوحة المفاتيح واستبدله هناك، ولا تضعه في الملف: التطبيق لا يقرأ مفتاح الخدمة.

## 6. هوية المشروع قبل الاتصال

فُحص DNS العام (`8.8.8.8`) في 2026-10-28:

- `pikqnlzkoaxoxpahtzvc.supabase.co` → `NXDOMAIN`
- `db.pikqnlzkoaxoxpahtzvc.supabase.co` → `NXDOMAIN`

لم يُفتح اتصال. فراغ القاعدة لا يُستنتج من لوحة المفاتيح.

## 7. قائمة السماح

`database/approved-staging-targets.json` هو قائمة السماح. أُضيف المرجع `pikqnlzkoaxoxpahtzvc` وحده. الإضافة لا تفتح اتصالاً ولا تعطّل الحارس: أي مضيف غير محلي ما زال يحتاج `--i-understand-this-is-staging` و`--expect-host` المطابق للمستخدم أو المضيف في سلسلة الاتصال، ويُرفض قبل `client.connect()`. اختبار `allows only the named staging project` يثبت أن القائمة تساوي هذا المرجع فقط.

## 8. فحص القراءة فقط

`scripts/staging-inspect.mjs` يبدأ معاملة `begin read only` ويقرأ إصدار الخادم واسم القاعدة و`schema_migrations` وعدد الصفوف في `tenants` و`invoices` و`items` و`journal_entries` و`stock_movements` و`customers` و`suppliers`، ثم `rollback`. لا يطبع سلسلة الاتصال. لم يُشغَّل: لا توجد `DATABASE_URL`، والاسم لا يُحل.

عندما تتوفر السلسلة ويُحل الاسم:

```
node --env-file=.env.staging scripts/staging-inspect.mjs --expect-host pikqnlzkoaxoxpahtzvc --i-understand-this-is-staging
```

## 9. بيانات الأعمال

غير معروفة. لم يُنفَّذ استعلام عدّ على القاعدة المستضافة. لقطة لوحة المفاتيح ليست دليلاً على أن القاعدة فارغة.

## 10. الترحيلات 0001–0017

سبعة عشر ملفاً بلا فجوات، بالترتيب: النواة، ثم CRM، المخزون، المالية، تمهيد المستأجر، عمليات المخزون، عروض الأسعار، الأتمتة، المنتجات، الهوية، التنظيم، دفتر الأستاذ، المشتريات، الشراء حتى الدفع، الإكمال المالي، تجميد ملاحظات الفاتورة، ثم التقييم التجريبي. لا ملفات تراجع. فشل ملف واحد يتراجع داخل معاملته ولا يُسجَّل في `schema_migrations`.

أُعيد اختبار المخطط والقائمة محلياً داخل Vitest (PGlite). هذا ليس دليلاً على PostgreSQL المستضاف.

## 11. النسخ الاحتياطي والاستعادة

لم يُؤخذ نسخ. خطة اشتراك Supabase لهذا المشروع لم تُقرأ في هذه الجلسة، لذلك لا يُفترض وجود استرجاع زمني. النسخ الذي لا يعتمد على إضافة مدفوعة هو `pg_dump` لهذا المشروع فقط، بعد نجاح فحص القراءة وقبل أي تطبيق، ويُحفظ خارج Git.

الاستعادة: إعادة ذلك التفريغ إلى المشروع نفسه، أو التخلص من مشروع Staging إذا أثبت الفحص أنه بلا صفوف أعمال. لا استعادة فوق أي مشروع آخر، ولا إعادة ضبط من هذه الجلسة.

## 12. التطبيق والتراجع — غير منفَّذين

بعد موافقة صريحة، وبعد أن يُظهر الفحص الأعداد:

```
node --env-file=.env.staging scripts/migrate.mjs --status --expect-host pikqnlzkoaxoxpahtzvc --i-understand-this-is-staging
node --env-file=.env.staging scripts/migrate.mjs --expect-host pikqnlzkoaxoxpahtzvc --i-understand-this-is-staging
```

الأمر الثاني هو الذي يكتب. التراجع من تطبيق ناجح هو استعادة النسخ، لا حذف القاعدة ولا تعطيل RLS.

## 13. الفحوص المحلية في هذه الجلسة

| الفحص | النتيجة |
| --- | --- |
| `tsc --noEmit` | 0 |
| `eslint` على `src` و`scripts` و`e2e` و`playwright.config.ts` | 0 |
| Vitest | 58 ملفاً، 1081 اختباراً، 412.94 ثانية، خروج 0 |
| `next build` | خروج 0، تجميع 28.7 ثانية |

تحذيرات رفض الطلبات العابرة وحدّ المعدّل ظهرت داخل اختبارات أمن ناجحة.

## 14. ما يبقى قبل الموافقة

1. أن يُحل `pikqnlzkoaxoxpahtzvc.supabase.co` و`db.pikqnlzkoaxoxpahtzvc.supabase.co`.
2. وضع `DATABASE_URL` الجديدة في `.env.staging` دون لصقها هنا.
3. تشغيل فحص القراءة وطباعة الأعداد، ومنها إثبات وجود بيانات أعمال أو غيابها.
4. أخذ `pg_dump` قبل التطبيق.
5. جملة موافقة صريحة على تطبيق `0001`–`0017` على هذا المرجع فقط.
