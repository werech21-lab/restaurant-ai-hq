# Agent Ownership Matrix

آخر تحديث: 2026-10-27. المسارات أدناه نسبة إلى `restaurant-ai-hqw/`. كل ما هو موسوم **(جديد)** غير موجود اليوم.

قواعد عامة: ملف واحد = مالك واحد. التعديل على ملف مملوك لدور آخر يتم بطلب في `INTEGRATION_CHECKLIST.md`. الأدوار تلتزم بـ `.cursor/rules/*.mdc`. الأدوار الجديدة أو المسارات الجديدة لا تُنشأ منطق أعمال قبل حسم الأسئلة المذكورة في كل دور.

## جدول الملفات المشتركة (قفل واحد في كل مرة)

| الملف | المالك | الحجم | سبب الخطر |
| --- | --- | --- | --- |
| `src/lib/i18n.tsx` | 8 Frontend & UX | 2,703 سطر | كل وحدة تضيف مفاتيح ar/en |
| `src/lib/auth/permissions.ts` | 10 Security & IAM | 85 سطرًا، 78 صلاحية | كل endpoint جديد يضيف صلاحية |
| `src/lib/domain-error.ts` | 1 Chief Architect | 29 سطرًا | رموز أخطاء 409 جديدة |
| `src/components/erp/api.ts` | 8 Frontend & UX | 197 سطرًا | خريطة `errorKeys` |
| `src/components/erp/ErpNav.tsx` | 8 Frontend & UX | 154 سطرًا | رابط لكل وحدة |
| `src/lib/__tests__/api-access-matrix.test.ts` | 10 Security & IAM | 245 سطرًا | يعدّ كل route (94 اليوم) |
| `src/lib/__tests__/architecture.test.ts` | 1 Chief Architect | 144 سطرًا | `ownedTables` وحدود الوحدات |
| `src/lib/__tests__/support/database.ts` | 9 Database & Integrations | 78 سطرًا | يشغّل كل الـ migrations |
| `database/migrations/*` | 9 Database & Integrations | 15 ملفًا (0001 إلى 0015) | ترقيم متسلسل |
| `package.json`, `package-lock.json` | 1 Chief Architect | | اعتماديات |
| `vitest.config.mts`, `.github/workflows/*` | 11 QA | | إعدادات التشغيل |

---

## 1. Chief Architect & Orchestrator

- **النطاق:** العقود المشتركة، حدود الوحدات، ترتيب الموجات، الدمج، البوابة الكاملة.
- **يملك:** `docs/**`, `.cursor/rules/**`, `src/lib/events/**`, `src/lib/domain-error.ts`, `src/lib/__tests__/architecture.test.ts`, `src/lib/__tests__/event-catalogue.test.ts`, `package.json`, `package-lock.json`.
- **مهام:**
  1. إصلاح خرق الحدود المُتحقَّق منه: `src/modules/ai/__tests__/ai-domain.test.ts:27` يستورد `@/modules/crm/domain/quotation` مباشرة (يجب أن يمر عبر `@/modules/crm/client`).
  2. كتابة العقد (أنواع، Zod، صلاحيات، أحداث) قبل كل موجة.
  3. تخصيص الوحدات الجديدة في `ownedTables` عند إضافتها.
  4. تشغيل البوابة الكاملة ودمج الفروع واحدًا بعد الآخر.
- **اعتماديات:** لا يعتمد على أحد؛ الجميع يعتمد عليه.
- **قبول:** `architecture.test.ts` ينجح؛ لا import عابر للحدود في كود الإنتاج؛ كل عقد موثّق قبل أن يبدأ مستهلكه.

## 2. Finance & Accounting

- **النطاق:** الفواتير، المدفوعات، دفتر الأستاذ، الفترات المحاسبية، التقارير المالية.
- **يملك:** `src/modules/finance/**`, `src/app/api/v1/finance/**`, `src/app/erp/finance/**`, `src/components/erp/FinanceDashboard.tsx`, `InvoiceForm.tsx`, `InvoicePanel.tsx`.
- **مهام:**
  1. شاشات دفتر الأستاذ: دليل الحسابات، القيود، ميزان المراجعة، الفترات (الـ API موجود، لا شاشات).
  2. إضافة اختبار عدم تطابق العملة لـ `invoice-db.test.ts` وتسجيل المدفوعات (`recordPayment`) (فجوة مُتحقَّق منها).
  3. نقل شاشات المالية من `src/components/erp` إلى `src/modules/finance/ui` (يتطلب طلب `ErpNav`/`api.ts` من الدور 8).
- **اعتماديات:** 8 (مفاتيح i18n والتنقل)، 9 (أي migration)، 10 (صلاحيات جديدة).
- **قبول:** القيود متوازنة (اختبار موجود يبقى أخضر)؛ كل مبلغ بالفلس وBigInt عند الضرب؛ شاشة ميزان المراجعة تعرض حالات التحميل والفراغ والخطأ؛ لا import لجداول وحدة أخرى.

## 3. Procurement

- **النطاق:** الموردون، طلبات الشراء، أوامر الشراء، الاستلام، فواتير الموردين، المرتجعات، إشعارات الدائن، المدفوعات، التسوية.
- **يملك:** `src/modules/procurement/**`, `src/app/api/v1/procurement/**`, `src/app/erp/procurement/**`.
- **مهام:**
  1. بعد التحقق من 0015 على Postgres حقيقي: معالجة أي اختلاف يظهر (مُعطِّل إنتاج).
  2. تنفيذ قرار قيمة الاستلام (سعر أمر الشراء مقابل تكلفة الوحدة) عند اتخاذه.
  3. معالجة حالة المستخدم متعدد الشركات (المتصفح لا يرسل `x-tenant-id`) بالتنسيق مع 10.
- **اعتماديات:** 2 (واجهات Within في finance)، 4 (استلام المخزون)، 9، 10.
- **قبول:** اختبار الدورة الشاملة (طلب شراء إلى تسوية الدفعة) يبقى ناجحًا على الأساسين؛ `p2p-financial` و`p2p-settlement-db` خضراء.

## 4. Inventory & Supply Chain

- **النطاق:** الأصناف، المستودعات، حركات المخزون، الأرصدة، المنتجات.
- **يملك:** `src/modules/inventory/**`, `src/app/api/v1/inventory/**`, `src/app/erp/inventory/**`, `src/app/admin/**`.
- **مهام:**
  1. اختبارات `catalog-service` (فجوة مُتحقَّق منها: لا اختبارات).
  2. تصميم الوصفات/BOM كحركات `stock_movements` فقط (**قبل التنفيذ: قرار منك عن التقييم والهدر**؛ ممنوع إدخال FIFO/متوسط بلا موافقة).
  3. تنظيف `src/app/admin` وربطه بشاشة الأصناف إن لزم.
- **اعتماديات:** 9 (migrations)، 7 (استهلاك المخزون من المبيعات)، 3.
- **قبول:** المخزون لا ينزل تحت الصفر (قيد قاعدة البيانات)؛ لا كتابة مباشرة في `stock_balances`؛ كل تغيير قاعدة له حالة في `inventory-db.test.ts`.

## 5. Sales & POS (وحدة جديدة)

- **النطاق:** أوامر البيع، نقطة البيع، ربط الفوترة وخصم المخزون.
- **يملك (جديد):** `src/modules/sales/**`, `src/app/api/v1/sales/**`, `src/app/erp/sales/**`.
- **حالة اليوم:** لا كود ولا جداول. أقرب موجود: عروض الأسعار في CRM وفواتير المبيعات B2B في finance.
- **أسئلة تحجب البدء (لن أخترع إجاباتها):** ضريبة المبيعات (نسبة، شمول/استثناء)، طرق الدفع في الكاشير، ردود الأموال، الخصومات والموافقات، الإغلاق اليومي للصندوق.
- **اعتماديات:** 1 (عقد)، 2 (قيود الإيراد)، 4 (خصم المخزون عبر `issueInvoiceStock`)، 6 (العملاء)، 9، 10.
- **قبول (بعد القرارات):** كل بيع ينتج فاتورة وحركة مخزون في معاملة واحدة؛ Idempotency-Key؛ اختبار تزامن؛ لا بيع بمخزون ناقص.

## 6. CRM

- **النطاق:** العملاء، العملاء المحتملون، عروض الأسعار، التحويل إلى فاتورة.
- **يملك:** `src/modules/crm/**`, `src/app/api/v1/crm/**`, `src/app/erp/crm/**`.
- **مهام:** تثبيت حدود الاستيراد (يتبع الدور 1)؛ جاهزية CRM كمصدر عملاء للمبيعات (الدور 5)؛ لا تغيّر حالة العميل كأثر جانبي.
- **اعتماديات:** 2 (الفواتير)، 4، 5.
- **قبول:** `crm-db.test.ts` يبقى أخضر؛ التحويل يبقى معاملة واحدة بالحدّ الائتماني.

## 7. Restaurant Operations (+ org وHR مستقبلًا)

- **النطاق:** العلامات والفروع، القوائم، الطاولات، المطبخ، الورديات، الموظفون.
- **يملك:** `src/modules/org/**`, `src/app/api/v1/org/**`، و(جديد) `src/modules/restaurant/**`, `src/modules/hr/**`, `src/app/erp/org/**`, `src/app/erp/restaurant/**`.
- **حالة اليوم:** org فيه API بلا شاشات. لا يوجد hr ولا مطبخ ولا قوائم ولا ورديات؛ الأقسام المقابلة في اللوحة الأم (`Kitchen.tsx`, `Delivery.tsx`, `Branches.tsx`, `Quality.tsx`) بيانات تجريبية ثابتة.
- **مهام الآن:** شاشات العلامات والفروع (الـ API جاهز).
- **أسئلة تحجب الباقي:** هيكل القوائم والأسعار، ورديات العمل، قواعد الرواتب (تذهب إلى finance عبر واجهة Within وليس كتابة مباشرة).
- **قبول:** عزل tenant في كل استعلام؛ كل كتابة تترك audit row.

## 8. Frontend & UX

- **النطاق:** المكونات المشتركة، التنقل، i18n، RTL/LTR، حالات التحميل/الفراغ/الخطأ.
- **يملك:** `src/components/ui/` (عند إنشائه)، `src/components/erp/api.ts`, `common.tsx`, `StatusBadge.tsx`, `styles.ts`, `ErpNav.tsx`, `src/lib/i18n.tsx`, `src/lib/nav.ts`, `src/app/layout.tsx`, `src/app/login/**`, و`src/components/*.tsx` للوحة الأم (`Sidebar`, `Topbar`, `CEORoom`...).
- **مهام:**
  1. اللوحة الأم `/` بياناتها ثابتة بالكامل (أمثلة: `CEORoom.tsx`, `Finance.tsx`, `Inventory.tsx`): إما ربطها بواجهات ERP الحقيقية أو وسمها صراحةً "عرض تجريبي".
  2. إزالة النصوص المكتوبة يدويًا (`layout.tsx`, `ErpNav.tsx`, `Sidebar.tsx`, `LoginForm.tsx`, بادئات `PR-`/`PO-`).
  3. تقسيم `i18n.tsx` إلى قواميس لكل وحدة لتقليل التعارض (تغيير بنيوي: يحتاج موافقة الدور 1).
- **اعتماديات:** كل الوحدات تطلب مفاتيح منه عبر الطابور.
- **قبول:** مفاتيح ar وen متطابقة (اختبار موجود)؛ كل شاشة غير مزيّفة؛ KWD بثلاث خانات.

## 9. Database & Integrations

- **النطاق:** المخطط، migrations، PGlite، تكامل Supabase، سكربتات الهجرة.
- **يملك:** `database/**`, `supabase/**`, `scripts/**`, `src/lib/db.ts`, `src/lib/db-ssl.ts`, `src/lib/sequences.ts`, `src/lib/idempotency.ts`, `src/lib/__tests__/support/database.ts`.
- **مهام:**
  1. جدول حجز أرقام migrations (انظر قائمة الدمج).
  2. إعداد تحقق على PostgreSQL حقيقي **على staging منفصل فقط وبموافقتك** (مُعطِّل إنتاج).
  3. فرض `DATABASE_SSL=verify` في الإنتاج بدل التحذير فقط (مُتحقَّق: يحذّر ولا يفشل).
- **ممنوع:** `npm run db:migrate`, `db:status:staging`, `scripts/migrate.mjs`, `staging-validate.mjs`, `products-report.mjs` مع ملفات env حقيقية.
- **قبول:** كل migration يمر في PGlite؛ `migration-safety.test.ts` أخضر؛ لا migration مدموج يُعدَّل.

## 10. Security & IAM

- **النطاق:** المصادقة، RBAC، IAM، RLS، الرؤوس الأمنية، الأسرار.
- **يملك:** `src/lib/auth/**`, `src/lib/iam/**`, `src/lib/api/route.ts`, `src/lib/supabase/**`, `src/lib/env.ts`, `security-headers.js`, `next.config.js`, `src/middleware.ts`, `src/app/api/v1/iam/**`, `src/lib/__tests__/{security-*,tenant-isolation-db,invitations-rls-db,api-access-matrix,auth-context}.test.ts`.
- **مهام (فجوات مُتحقَّق منها):**
  1. لا rate limiting ولا حماية CSRF في `src`.
  2. شاشات الأعضاء والأدوار (الـ API موجود).
  3. معالجة حالة المستخدم متعدد الشركات (اختيار الشركة بدل `x-tenant-id` المفقود).
  4. اختبارات منع UPDATE على كل كيانات التدقيق (اليوم مُغطى `audit_log` فقط).
- **قبول:** كل route يمر بـ `protectedRoute` أو `sessionRoute` (94 route، واحد استثناء بالتصميم)؛ لا `service_role` في العميل (اختبار ساكن موجود)؛ لا تخفيف RLS.

## 11. QA & Automated Testing

- **النطاق:** البوابة الآلية، CI، سد فجوات الاختبار.
- **يملك:** `vitest.config.mts`, `.github/workflows/**`, `src/**/__tests__/**` (لوحدة غيره بالاتفاق مع مالك الوحدة؛ ملفات الاختبار الجديدة فقط).
- **مهام:**
  1. إضافة سقف عمّال في الإعداد (`maxWorkers`) بدل الاعتماد على الأعلام.
  2. فجوات مُتحقَّق منها: عدم تطابق العملة في `invoice-db.test.ts` وتسجيل المدفوعات؛ اختبارات `catalog-service`؛ `proposal_stale` في المخزون غير مطلوب (تأكيد مع الدور 4).
  3. تشغيل CI عند دفع الفرع (بعد موافقتك على الدفع) والتأكد من نجاحه.
- **قبول:** `typecheck`، `lint`، `vitest` خضراء؛ لا تُزوَّر نتيجة؛ كل منطق مالي أو مخزني له اختبار تقريب وصفر وسالب وعملة.

## 12. AI Decision Intelligence

- **النطاق:** محرك القرار الحتمي، القواعد، الاقتراحات، الموافقات.
- **يملك:** `src/modules/ai/**`, `src/app/api/v1/ai/**`, `src/app/erp/ai/**`, `src/app/erp/page.tsx`, `src/lib/assistant.ts`, `src/components/{Assistant,Agents,Intelligence,Recommendations}.tsx`.
- **مهام:** قواعد جديدة للمشتريات (مثل فروقات المطابقة والدفع المتأخر) **فقط بعد موافقتك** لأن إضافة مفتاح قاعدة أو نوع إجراء ممنوعة دون سؤال؛ استبدال المساعد المكتوب نصًا (`assistant.ts`) بقراءة حقيقية من الـ API.
- **اعتماديات:** كل الوحدات عبر واجهاتها العامة (Within فقط)، 8، 9.
- **قبول:** لا نموذج لغوي ولا API خارجي؛ نفس البيانات تعطي نفس النتائج؛ العتبات في `erp_automation_rules`؛ لا كتابة في جداول وحدة أخرى.

---

## من يعتمد على من

```
1 Chief Architect (عقود) ──► 2,3,4,5,6,7,12 (وحدات الأعمال)
9 Database ──► كل من يضيف جدولًا
10 Security ──► كل من يضيف endpoint (صلاحية + مصفوفة الوصول)
8 Frontend ──► كل من يضيف شاشة (مفاتيح + تنقل)
11 QA ──► بوابة كل دمج
```
