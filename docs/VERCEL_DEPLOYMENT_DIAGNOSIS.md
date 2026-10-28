# تشخيص نشر Vercel — Aether BI

التاريخ: 2026-10-28. التحقق تم بأمر Vercel CLI على الحساب `werech21-lab`، ثم بطلب HTTP إلى الموقع العام.

## الربط الفعلي

| البند | النتيجة |
| --- | --- |
| المشروع المالك للنطاق | `restaurant-ai-hq-v23` |
| المعرف | `prj_xtpiDK6iXstPb90eoTezTFmiiA13` |
| النطاقات | `aetherbi.com`، `www.aetherbi.com` |
| DNS | `www` إلى `cname.vercel-dns.com`. القمة `A` = `76.76.21.21`. خوادم الأسماء `domaincontrol.com` |
| الجذر | `.` |
| Node | `24.x` |
| المنطقة | `iad1` |
| إطار العمل في إعداد المشروع | المعاينة النصية تقول Other، لكن نشر فرع التطوير أنتج دوال Next.js |
| أمر البناء | `npm run build` |
| متغيرات البيئة | لا مفاتيح على أي بيئة |
| فرع الإنتاج | `main`، والاسم المستعار `restaurant-ai-hq-v23-git-main-werech21-lab.vercel.app` |
| آخر إنتاج | 25 أكتوبر 2026. البناء يحتوي الصفحة الرئيسية فقط |
| المستودع | `werech21-lab/restaurant-ai-hq` |

`restaurant-ai-hq` و`restaurant-ai-hq-v2` لا يملكان النطاق. لم يُغيَّر توجيه الإنتاج.

## لماذا تبقى الغرفة القديمة

`main` لا يحتوي `/erp`. فرع `cursor/erp-finance-inventory-crm` يحتوي ERP ومركز التطبيقات. دفع الفرع ينشئ Preview. حماية `vercel_authentication` تمنع الزائر بلا جلسة الفريق. `https://www.aetherbi.com/` بعد نشر المعاينة ما زال بلا `erp-apps`، و`/erp` يعيد 404. ليس تخزينًا مؤقتًا لصفحة جديدة: الإنتاج بناء أقدم.

## المعاينة

https://restaurant-ai-hq-v23-6agcxy2gj-werech21-lab.vercel.app

`READY`، وليست إنتاجًا. `vercel curl` أثبت وجود المركز وروابط ERP، و`/erp/finance` يعيد `307` إلى `/login`. المتصفح بلا جلسة Vercel يصل إلى صفحة الدخول.
