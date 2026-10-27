# تغطية التدقيق: ما أصبح مُثبَتًا وما لا يزال بلا دليل

ملفان جديدان فقط، لا تعديل على أي ملف قائم:

- `src/lib/__tests__/audit-integrity-db.test.ts` — 15 اختبارًا.
- `src/modules/finance/__tests__/books-and-stock-db.test.ts` — 26 اختبارًا.

كلاهما يعمل على PGlite في الذاكرة بعد إعادة تشغيل كل migration في `database/migrations/` (0001 إلى 0015). التواريخ كلها ثابتة، فلا شيء هنا يعتمد على ساعة الجهاز.

## 1. ما يثبته كل اختبار

### سلامة سجل التدقيق (`audit-integrity-db.test.ts`)

| الادعاء | الاختبار |
| --- | --- |
| لكل إنشاء وتعديل وحذف تقوم به الخدمات صف تدقيق باسم الفاعل والكيان والفعل | `every business write leaves an audit row > covers all 70 or more creates, updates and deletes` (سيناريو يعدّ أكثر من 70 عملية صراحةً عبر org وinventory وcrm وfinance وprocurement وiam وai) |
| التغطية تمس كل وحدة | `reaches every module` (30 اسم كيان) |
| «مَن» و«متى» موجودان دائمًا، والفاعل مستخدم حقيقي | `names who, what and when on every row` |
| «قبل» و«بعد» متوافقان مع الفعل: إنشاء بلا قبل، حذف بلا بعد | `keeps before and after in step with the action` |
| لكل صف أعمال كتبته الخدمات صف إنشاء، جدولًا بجدول (25 جدولًا) | `has a create row for every business record the services wrote` |
| لكل سجل تجاوزت نسخته 1 صف تعديل (19 جدولًا) | `has an update row for every record that moved past its first version` |
| صف التدقيق يُكتب داخل معاملة السجل نفسه لا بعدها | `writes the audit row in the same transaction as the record` |
| لا تعديل ولا حذف لصف تدقيق من اتصال الخادم المالك نفسه (مشغّلات `prevent_update` و`prevent_delete`) | `the audit trail cannot be rewritten > refuses an update or a delete from the server's own owner connection` |
| ولا من مالك الشركة الموقَّع عبر Supabase: لا صلاحية كتابة أصلًا | `refuses them to a signed-in tenant owner` |
| الصفوف ما زالت موجودة بعد كل المحاولات (الاختبارات ليست فارغة) | `keeps the owner connection able to read it` |
| لا صف تدقيق يشير إلى سجل أو فاعل شركة أخرى | `the audit trail is tenant scoped > never points a row at another company's record or actor` |
| كل مالك يرى صفوف شركته وحدها عبر RLS | `shows each owner only their own rows through Supabase` |
| عضو بلا `finance.invoice.read`، وغريب، و`anon`: لا شيء | `shows nothing to a member without finance.invoice.read` |
| معاملة فشلت عند الـ commit لا تترك صف تدقيق ولا صف أعمال | `a transaction that fails leaves no audit row > rolls the audit row back with the record` |
| قاعدة أعمال ترفض الطلب لا تكتب تدقيقًا | `writes no audit row for a business rule that refuses the request outright` |

### حصانة السجلات المالية ومطابقة الكتب للمخزون (`books-and-stock-db.test.ts`)

ما **ترفضه قاعدة البيانات نفسها** (SQL خام على اتصال المالك، بلا خدمة):

| السجل | تعديل | حذف |
| --- | --- | --- |
| قيد مُرحَّل وسطوره | `posted journal entry cannot change` / `lines of a posted` | `cannot be deleted` |
| دفعة مبيعات | `are immutable` | `cannot be deleted` |
| دفعة مورد وتخصيصاتها | `cannot change` / `are immutable`، و`status='void'` يحتاج قيدًا عاكسًا | `cannot be deleted` |
| إشعار دائن مورد وسطوره | `cannot change` / `are immutable` | `cannot be deleted` |
| فاتورة مورد وسطورها | `cannot change` / `are immutable` | `cannot be deleted` |
| فاتورة مبيعات مُصدَرة | المبالغ والتواريخ والعميل والرقم: `cannot change its amounts`؛ السطور: `only change while the invoice is a draft`؛ `paid_minor` لا ينزل | `cannot be deleted` |

وإضافة: إلغاء فاتورة مبيعات مدفوعة بتعديل يدوي يصطدم بقيد `invoices_payment_state`؛ وقيد عكسي مزوَّر لا يعكس الأصل سطرًا بسطر يُرفض بـ `mirror`؛ وقيد ناتج عن مستند مشتريات `cannot be reversed` إلا بإلغاء المستند.

ما **ترفضه الخدمة وحدها**: تعديل فاتورة غادرت المسودة (`not_editable`)، إلغاء فاتورة مدفوعة (`cannot_void`)، إلغاء فاتورة مورد عليها دفعة أو إشعار دائن (`409:invoice_has_payments`)، وإلغاء الدفعة أو الإشعار مرتين (`409:payment_not_posted` و`409:credit_note_not_posted`). والتصحيح الوحيد المسموح مُثبَت: عكس القيد يترك الأصل كما هو حرفيًا وينفي الأثر على كل حساب مسته الحركة، والإلغاء يكتب قيدًا عاكسًا ولا يحذف شيئًا.

**مطابقة الكتب للمخزون** بعد دورة شراء كاملة (طلب شراء ← اعتماد ← أمر ← استلام ← فاتورة مورد ← مرتجع ← إشعار دائن ← دفعة جزئية) على **الأساسين**:

- كل قيد مُرحَّل متوازن للفلس، ولا مسودة متروكة، وميزان المراجعة متوازن.
- **القيمة المقارَنة هي سعر أمر الشراء** (`purchase_order_lines.unit_cost_minor`) مضروبًا في `stock_balances.on_hand` الذي تحفظه المشغّلات، **وليس** تكلفة الصنف في الكتالوج (`items.unit_cost_minor` = 0.800 هنا عمدًا). الاختبار يحسب القيمتين ويؤكد اختلافهما قبل المقارنة.
  - أساس الاستلام: حساب المخزون = 18.000 = `on_hand × سعر الأمر` بالكامل، وGRNI = −10.000 = قيمة البضاعة المستلمة وغير المفوترة (5 سكر).
  - أساس الفاتورة: حساب المخزون = 8.000 = صافي المفوتر فقط، وGRNI صفر، والفارق 10.000 بضاعة على الرف بلا قيمة في الدفتر.
- دفتر الحركات = الأرصدة = `items.current_stock`، ولا رصيد سالب.
- رصيد المورد = الإجمالي − المدفوع − المُقاصّ (10.500 − 3.000 − 2.100 = 5.400)، محسوبًا من الجداول ومن الخدمة، ويساوي رصيد حساب الدائنين.
- تقرير `getReconciliation` بلا فروق على الأساسين.

## 2. عيوب رأيتُها في المخرجات الفعلية

1. **صف تدقيق «إنشاء» يحمل حالة سابقة مُصطنَعة.** `src/modules/procurement/services/procurement-service.ts:158` و`src/modules/procurement/services/invoice-service.ts:110` يكتبان `action = 'create'` عند أول ضبط للإعدادات، لكنهما يمرّران `before` = صف الافتراضات بالنسخة 0 بدل لا شيء. المتوقَّع: `before` فارغ في الإنشاء. الواقع: كائن كامل. لذلك استُثني الكيانان `procurement_settings` و`procurement_accounting` صراحةً من فحص «قبل/بعد» في `audit-integrity-db.test.ts`، مع تعليق يحيل إلى هذا المستند. الكيانات الثمانية والعشرون الأخرى تمرّ.
2. **`notes` على فاتورة مُصدَرة ليست مجمَّدة في قاعدة البيانات.** مشغّل `invoices_freeze` في `database/migrations/0004_finance.sql:124-145` يُجمِّد الرقم والعميل والعملة والتواريخ والمبالغ فقط. فعليًا: `update invoices set notes = '...'` على فاتورة مدفوعة ينجح (`toBe('ok')` في `books-and-stock-db.test.ts`). الحارس الوحيد هو `assertEditable` في الخدمة. ليس خطأ ماليًا، لكنه بالضبط الفرق بين «ما ترفضه القاعدة» و«ما ترفضه الخدمة».
3. **البيع يُنقص المخزون ولا يمسّ حساب المخزون.** لا يوجد ترحيل لتكلفة البضاعة المباعة في هذا الإصدار. الاختبار `the boundary of the books-versus-stock identity` يقيس ذلك: 20 وحدة دخلت يدويًا، 6 بيعت بفاتورة مُصدَرة، الرصيد 14، وحساب المخزون صفر. لذلك مطابقة «حساب المخزون = المخزون × سعر الأمر» مُثبَتة على شركات شراء فقط، ولا تصحّ بعد أي بيع.
4. **`writeAudit` يخزّن `null` كقيمة JSON لا كـ SQL NULL** (`src/lib/audit.ts:24`). أي فحص بـ `before is null` يمرّ دائمًا بلا أن يفحص شيئًا. فحوص هذا الملف تستعمل `jsonb_typeof(...) = 'null'`.

## 3. ادعاءات ما زالت بلا دليل

- **`TRUNCATE audit_log`**: مشغّلات الصفوف لا تُستدعى مع `TRUNCATE`، ولم أختبرها، فلا دليل على أن اتصال الخادم المالك لا يستطيع مسح السجل كاملًا. (مالك الشركة الموقَّع لا يستطيع: لا صلاحية `TRUNCATE` له، وهذا مُثبَت في `security-db.test.ts`.)
- **الأقفال الحقيقية**: PGlite تُسلسل المعاملات، فكل ما يخص التزامن هنا وفي بقية الملفات يثبت النتيجة لا عمل `for update` على PostgreSQL حقيقي.
- **«كل» دالة خدمة**: التغطية سيناريو بعملياته المُعدَّدة في الملف، زائد فحص جدولي يشمل 25 جدولًا للإنشاء و19 جدولًا ذا نسخة للتعديل. لا يوجد فحص ثابت (static) يمنع إضافة دالة خدمة جديدة بلا تدقيق.
- **المسارات غير المُشغَّلة**: `rejectRequest`, `cancelRequest`, `cancelOrder`, `approveOrder`, `rejectQuotation`, `expireQuotation`, `convertQuotation`, `revokeInvitation`, `rejectApproval`, `holdCustomerWithin`, `setSellingPriceWithin`, `applyDraftDiscountWithin`, `receiveRestockWithin` — كلها تكتب تدقيقًا في الكود، ولم يُشغَّل أثرها في هذين الملفين.
- **التدقيق عبر طبقة الـ route**: الاختبارات تستدعي الخدمات مباشرة، لا عبر `api/v1`.
- **قيمة المخزون بطريقة تكلفة أخرى** (FIFO أو المتوسط): غير موجودة أصلًا، ولم تُختبر.
- **PostgreSQL حقيقي**: migrations 0009 إلى 0015 لم تُطبَّق على قاعدة حقيقية، كما في `RELEASE_CLOSEOUT_1_4.md` القسم 6.
