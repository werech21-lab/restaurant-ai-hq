# حالة الربط المستضاف — Aether BI

التاريخ: 2026-10-28. الفرع: `cursor/erp-finance-inventory-crm`.

**BLOCKED — MISSING DATABASE CREDENTIALS**

لم يُفتح اتصال PostgreSQL. لم تُطبَّق ترحيلات. لم يُدوَّر مفتاح. لم يُعطَّل التحقق من شهادة TLS.

## الهوية

المرجع المكتوب `pikqnlzkoaxoxpahtzvc` غير موجود في حساب Supabase المصادق عليه، و`pikqnlzkoaxoxpahtzvc.supabase.co` و`db.pikqnlzkoaxoxpahtzvc.supabase.co` ما زالا `NXDOMAIN`.

المشروع الوحيد الذي اسمه `aether-bi-staging` في هذه الجلسة هو:

| البند | القيمة |
| --- | --- |
| المرجع | `pikqnlzkoaxoxpahztvc` |
| الحالة | `ACTIVE_HEALTHY` |
| المنطقة | `ap-southeast-1` |
| المنظمة | `xwmjximjrtkzwytbhdig` |
| الإنشاء | 2026-10-28 |

الفرق بين المرجعين هو تبديل حرفين: `ht` في المرجع المكتوب و`hz` في المشروع الحي. عنوان الواجهة للمشروع الحي يُحل. عنوان قاعدة البيانات المباشر يُحل إلى IPv6 فقط. مجمع الجلسة `aws-0-ap-southeast-1.pooler.supabase.com:5432` يُحل إلى IPv4.

المفتاح القابل للنشر المخزن محليًا تقبله واجهة المشروع الحي (`no_authorization` بدل `Invalid API key`). عنوان `.env.staging` صُحّح إلى هذا المشروع، و`DATABASE_SSL=verify` حتى يُفحص شهادة الخادم. الملف مستبعد من Git ولا يحتوي `DATABASE_URL` ولا مفتاحًا سريًا.

## ما فُحص ولم يُطبع

جلسة Supabase CLI موجودة في مدير اعتمادات ويندوز. لا ترى المرجع المكتوب، وترى المشروع الحي أعلاه. لا توجد كلمة مرور قاعدة بيانات في ملفات البيئة ولا في إعدادات CLI.

المتصفح يحتفظ بإدخال اسمه `aether-bi-staging` ضمن منظمة المشروع الحي. القيمة مشفرة بتشفير Chrome المرتبط بالتطبيق (`v20`)، وخدمة فك التشفير لا تُظهر الواجهة المطلوبة. لم تُفك القيمة ولم تُنسخ.

قائمة السماح ما زالت تحتوي المرجع غير الموجود. لذلك يرفض مشغّل الترحيل المشروع الحي قبل أي اتصال.

## ما يُكتب محليًا، لا في المحادثة

في `restaurant-ai-hqw/.env.staging`:

```
DATABASE_URL=postgresql://postgres.pikqnlzkoaxoxpahztvc:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
DATABASE_SSL=verify
```

كلمة المرور هي كلمة مرور PostgreSQL لهذا المشروع، وليست مفتاح واجهة. بعد كتابتها يُشغَّل فحص القراءة فقط، ثم تُراجع النسخ الاحتياطية، ثم تُطلب موافقة قبل أي ترحيل.
