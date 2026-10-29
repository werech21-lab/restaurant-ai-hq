# تصميم الأحداث التشغيلية الموحّد

يغذّي هذا التصميم محرك الاستخبارات والتحليلات والوكلاء الأذكياء. **الجزء المنفَّذ فعلاً** هو الناقل داخل العملية `src/lib/events/bus.ts` وأسماء الأحداث المذكورة في الجدول المنفَّذ أدناه (يتحقق منها اختبار آلي). **الجزء التصميمي** (الغلاف الموسَّع، الـ outbox، المستهلكون الدائمون) لم يُنفَّذ بعد ويحتاج قراراً بشأن الطابور (القاعدة: لا Redis ولا WebSockets دون طلب).

## 1. العقد الحالي (منفَّذ)

```ts
type BusEvent = {
  name: string        // <module>.<entity>.<past-tense-verb>
  version: number     // نسخة شكل الحمولة
  occurredAt: string  // ISO 8601 UTC
  tenantId: string    // كل حدث ينتمي لمؤسسة واحدة
  payload: unknown    // مُنمَّطة لكل حدث
}
```

قواعد ملزمة (موجودة في القواعد وتطبّقها الشيفرة):

1. **بعد الـ commit فقط.** تُجمع الأحداث داخل المعاملة وتُنشر بعد نجاحها. فشل المعاملة = لا حدث.
2. **المعالجات متكافئة (idempotent).** قد يصل الحدث أكثر من مرة.
3. **فشل معالج لا يوقف المُصدِر.** `emit` يستخدم `Promise.allSettled` ويسجّل الفشل عبر `logger`.
4. **الحمولة معرّفات وأرقام، لا بيانات شخصية.** أحداث `iam.*` لا تحمل بريداً ولا رمز دعوة (مختبَر).
5. **الأسماء `<module>.<entity>.<past_tense>`** بأحرف صغيرة وشرطة سفلية (مختبَر).

## 2. الأحداث المنفَّذة اليوم

الجدول التالي مرتبط باختبار `src/lib/__tests__/event-catalogue.test.ts`: يفشل إن أُضيف حدث في الشيفرة دون أن يُسجَّل هنا أو سُجِّل هنا حدث غير موجود في الشيفرة.

<!-- implemented:start -->
| الحدث | المصدر |
| --- | --- |
| `ai.approval.executed` | ai |
| `ai.approval.rejected` | ai |
| `ai.approval.requested` | ai |
| `ai.insight.detected` | ai |
| `ai.scan.completed` | ai |
| `crm.customer.created` | crm |
| `crm.customer.updated` | crm |
| `crm.lead.created` | crm |
| `crm.lead.lost` | crm |
| `crm.lead.moved` | crm |
| `crm.lead.updated` | crm |
| `crm.lead.won` | crm |
| `crm.quotation.converted` | crm |
| `crm.quotation.created` | crm |
| `crm.quotation.status_changed` | crm |
| `crm.quotation.updated` | crm |
| `delivery.order.recorded` | delivery |
| `delivery.order.settled` | delivery |
| `finance.account.created` | finance |
| `finance.account.updated` | finance |
| `finance.invoice.approved` | finance |
| `finance.invoice.created` | finance |
| `finance.invoice.issued` | finance |
| `finance.invoice.paid` | finance |
| `finance.invoice.submitted` | finance |
| `finance.invoice.updated` | finance |
| `finance.invoice.voided` | finance |
| `finance.journal.created` | finance |
| `finance.journal.posted` | finance |
| `finance.journal.reversed` | finance |
| `finance.payment.recorded` | finance |
| `finance.period.closed` | finance |
| `finance.period.created` | finance |
| `hr.expense.decided` | hr |
| `hr.leave.decided` | hr |
| `hr.payroll.posted` | hr |
| `governance.archive.routed` | governance |
| `governance.circular.enforced` | governance |
| `governance.compliance.blocked` | governance |
| `governance.contract.analyzed` | governance |
| `governance.radar.recorded` | governance |
| `governance.telemetry.recorded` | governance |
| `governance.investigation.opened` | governance |
| `governance.investigation.ruled` | governance |
| `governance.monitoring.converted` | governance |
| `governance.task.completed` | governance |
| `governance.task.dispatched` | governance |
| `governance.violation.closed` | governance |
| `hr.appointment.booked` | hr |
| `hr.appointment.completed` | hr |
| `iam.invitation.accepted` | `src/lib/iam` |
| `iam.invitation.created` | `src/lib/iam` |
| `iam.invitation.revoked` | `src/lib/iam` |
| `iam.member.removed` | `src/lib/iam` |
| `iam.member.role_changed` | `src/lib/iam` |
| `iam.role.created` | `src/lib/iam` |
| `iam.role.updated` | `src/lib/iam` |
| `inventory.item.created` | inventory |
| `inventory.item.reorder_level_reached` | inventory |
| `inventory.item.updated` | inventory |
| `inventory.stock.depleted` | inventory |
| `inventory.stock.moved` | inventory |
| `inventory.warehouse.created` | inventory |
| `inventory.warehouse.updated` | inventory |
| `kitchen.production.recorded` | kitchen |
| `kitchen.waste.recorded` | kitchen |
| `org.branch.created` | org |
| `procurement.invoice.posted` | procurement |
| `procurement.invoice.voided` | procurement |
| `procurement.creditnote.posted` | procurement |
| `procurement.creditnote.voided` | procurement |
| `procurement.payment.posted` | procurement |
| `procurement.payment.voided` | procurement |
| `procurement.return.posted` | procurement |
| `procurement.order.approved` | procurement |
| `procurement.order.cancelled` | procurement |
| `procurement.order.created` | procurement |
| `procurement.order.submitted` | procurement |
| `procurement.receipt.posted` | procurement |
| `procurement.request.approved` | procurement |
| `procurement.request.cancelled` | procurement |
| `procurement.request.converted` | procurement |
| `procurement.request.created` | procurement |
| `procurement.request.rejected` | procurement |
| `procurement.request.submitted` | procurement |
| `procurement.supplier.created` | procurement |
| `procurement.supplier.updated` | procurement |
| `org.branch.updated` | org |
| `org.brand.created` | org |
| `org.brand.updated` | org |
<!-- implemented:end -->

ملاحظة انحراف: `iam` ليس بين الوحدات الخمس في `erp-core.mdc`. وُضع في `src/lib/iam` كبنية مشتركة، وأسماء أحداثه تتبع الصيغة نفسها. يحتاج قراراً: إما إضافته رسمياً كوحدة أو إبقاؤه بنية مشتركة.

## 3. الغلاف الموسَّع المقترح (تصميم، غير منفَّذ)

يُضاف للعقد الحالي دون كسره (النسخة `version` للحمولة، و`envelope` للغلاف):

| الحقل | الغرض |
| --- | --- |
| `eventId` (UUID) | مفتاح التكافؤ للمستهلكين: «عالجتُ هذا الحدث من قبل» |
| `correlationId` | يربط كل ما نتج عن طلب مستخدم واحد |
| `causationId` | الحدث أو الأمر الذي سبّب هذا الحدث (سلسلة السببية للتدقيق) |
| `actor` | `{ type: 'user' \| 'system' \| 'ai', id }`. حدث الوكيل الذكي يُعلَّم `ai` دائماً |
| `entityId` | معرّف الكيان صاحب الحدث (للتجميع حسب الكيان) |
| `branchId` / `brandId` (اختياري) | بعد اعتماد نموذج العلامات والفروع |
| `schemaVersion` | يُرفع عند تغيير شكل الحمولة، ويبقى المستهلكون القدامى يقرؤون النسخة السابقة فترة انتقالية |

## 4. التسليم الموثوق: جدول outbox (تصميم)

الناقل داخل العملية يضيع حدثه إذا سقطت العملية بين الـ commit والنشر. الحل المعتمد عند اختيار الطابور:

```sql
-- مقترح، لم يُنفَّذ، يحتاج موافقة قبل أن يصبح ترحيلاً
create table event_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null check (name ~ '^[a-z]+\.[a-z_]+\.[a-z_]+$'),
  schema_version int not null check (schema_version >= 1),
  occurred_at timestamptz not null,
  payload jsonb not null,
  actor_type text not null, actor_id uuid,
  correlation_id uuid, causation_id uuid,
  published_at timestamptz,          -- null = لم يُنشر بعد
  attempts int not null default 0
);
```

- يُكتب الصف **داخل نفس المعاملة** التي غيّرت البيانات (فلا حدث بلا تغيير ولا تغيير بلا حدث).
- ناشر منفصل يقرأ `published_at is null` مرتباً بـ `occurred_at` ويدفع للطابور، ثم يضع `published_at`. التسليم **مرة على الأقل**، لذلك المعالجات متكافئة.
- جدول `event_consumptions (consumer, event_id, processed_at)` بمفتاح فريد `(consumer, event_id)` يمنع تكرار الأثر.
- الجدول append-only (لا تعديل ولا حذف سوى `published_at/attempts` عبر الناشر).

## 5. استهلاك المحرك الذكي والتحليلات

| المستهلك | يقرأ | يفعل |
| --- | --- | --- |
| محرك الاستخبارات (`ai`) | أحداث finance وinventory وcrm | يعيد تقييم القواعد الحتمية المتأثرة فقط (بدل المسح الكامل) ويحدّث النتائج حسب `fingerprint` |
| الوكلاء الأذكياء | الأحداث + نتائج المحرك | **يقترحون فقط.** لا ينفَّذ شيء قبل موافقة بشرية، وعبر دوال `...Within` العامة للوحدات، ولا يكتبون جداول وحدة أخرى |
| التحليلات | كل الأحداث | تجميعات للقراءة (مؤشرات يومية لكل مؤسسة)، بلا أي كتابة في جداول الوحدات |
| التدقيق | أحداث `iam.*` وكل تغيير حساس | يطابق صفوف `audit_log` مع الأحداث للكشف عن أي تغيير بلا أثر |

قواعد خاصة بالوكلاء:

1. حدث من وكيل ذكي يحمل `actor.type = 'ai'` ولا يُعدّ موافقة.
2. حلقة التغذية الراجعة ممنوعة: حدث ناتج عن تنفيذ اقتراح وكيل (`causationId` يشير لموافقة) لا يطلق اقتراحاً جديداً من نفس القاعدة خلال فترة تهدئة.
3. العتبات تبقى في `erp_automation_rules.condition_json` لا في الشيفرة ولا في الأحداث.

## 6. أحداث مخططة للنواة الموسَّعة (غير منفَّذة)

لن يُضاف أي منها قبل اعتماد تصميم الوحدة الخاصة به (انظر `docs/ERP_CORE_DESIGN.md`). أسماؤها هنا للتوحيد فقط ولا يفحصها الاختبار الآلي.

| المجال | الأحداث المقترحة |
| --- | --- |
| المحاسبة | (نُفّذت: `finance.journal.*` و`finance.period.*` و`finance.account.*`). المخطط لاحقاً: `finance.journal.auto_posted` بعد قرار الترحيل التلقائي |
| المخزون | `inventory.valuation.recalculated`, `inventory.stocktake.completed` |
| المشتريات | (نُفّذت: `procurement.order.*` و`procurement.receipt.posted` و`procurement.supplier.created/updated` و`procurement.request.*` و`procurement.invoice.posted/voided` و`procurement.payment.posted/voided` و`procurement.creditnote.posted/voided` و`procurement.return.posted`) |
| المبيعات | `finance.credit_note.issued` (بعد قرار ذلك) |
| العقود | `contract.contract.activated`, `contract.amendment.approved`, `contract.contract.expired` |
| المؤسسة | (نُفّذت: `org.brand.created/updated` و`org.branch.created/updated`). المخطط لاحقاً: `org.branch.opened`, `org.branch.closed` عند اعتماد دورة حياة الفرع |
| الموافقات | `approval.request.submitted`, `approval.request.decided` |

## 7. الخصوصية والأمان

- الحمولة بلا بريد ولا اسم ولا رمز ولا مفتاح. تُحلّ الأسماء من المصدر عند الحاجة بصلاحيات المستهلك.
- كل حدث يحمل `tenantId` ويُفلتر به في كل مستهلك (لا مستهلك يعمل عابراً للمؤسسات).
- لا يُسجَّل محتوى الحمولة في السجلات (فقط الاسم والمؤسسة ونوع الخطأ).
