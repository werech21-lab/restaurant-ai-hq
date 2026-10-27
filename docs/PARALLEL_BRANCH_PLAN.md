# خطة الفروع المتوازية للأدوار الاثني عشر

آخر تحديث: 2026-10-27. تكمل هذه الخطة `AGENT_OWNERSHIP_MATRIX.md` (من يملك أي ملف) و`INTEGRATION_CHECKLIST.md` (بوابة الدمج).

## 1. الأساس المشترك

كل الفروع تبدأ من آخر commit على `cursor/erp-finance-inventory-crm` بعد إغلاق 1.4. هذا ما جعل الـ commits ضرورية: الـ worktree ينشأ من commit، فالأعمال غير الملتزم بها كانت تمنع أي توازٍ حقيقي.

```
cursor/erp-finance-inventory-crm   (الأساس، لا يُدمج في main بلا موافقة)
└── factory/<role>/<task>           (فرع لكل مهمة، لا لكل دور)
```

مثال: `factory/security/tenant-picker`، `factory/finance/ledger-screens`.

## 2. worktrees

```powershell
# من جذر المستودع، لكل مهمة:
git worktree add ../aether-wt/<task> -b factory/<role>/<task>
# عند الانتهاء والدمج:
git worktree remove ../aether-wt/<task>
```

قيود مقيسة على هذا الجهاز (4 معالجات، 8 GB، أقل من 1 GB حرة):

- **ثلاثة worktrees فعّالة كحد أقصى** إضافةً إلى الشجرة الرئيسية. كل `node_modules` نسخة مستقلة (نحو 700 MB لكل واحدة) ما لم تُشارَك.
- **فتحة تحقق واحدة:** `npx vitest run` الكامل و`next build` و`tsc` تُشغَّل واحدة في كل مرة من الشجرة الرئيسية. الوكيل في الـ worktree يشغّل ملف اختباره فقط بـ `--maxWorkers=1`.
- التشغيل الكامل يستغرق نحو 150 ثانية، والبناء نحو 195 ثانية؛ خطّط على أساس ذلك.

## 3. الفروع وملكية الملفات

| الدور | الفرع المقترح أولًا | الملفات التي يكتبها | لا يلمس |
| --- | --- | --- | --- |
| 1 Chief Architect | الشجرة الرئيسية | `docs/**`, `.cursor/rules/**`, `src/lib/events/**`, `domain-error.ts`, `architecture.test.ts`, `package*.json` | كود الوحدات |
| 2 Finance | `factory/finance/ledger-screens` | `src/modules/finance/**`, `src/app/api/v1/finance/**`, `src/app/erp/finance/**` | وحدات أخرى |
| 3 Procurement | `factory/procurement/real-db-fixes` | `src/modules/procurement/**`, `src/app/api/v1/procurement/**`, `src/app/erp/procurement/**` | finance/inventory داخليًا |
| 4 Inventory | `factory/inventory/bom-design` | `src/modules/inventory/**`, `src/app/admin/**` | `stock_balances` من الكود |
| 5 Sales & POS | `factory/sales/contract` | `src/modules/sales/**` (جديد) | كل ما سواه |
| 6 CRM | `factory/crm/sales-handoff` | `src/modules/crm/**`, `src/app/erp/crm/**` | finance/inventory داخليًا |
| 7 Restaurant Ops | `factory/org/brand-branch-screens` | `src/modules/org/**`, `src/modules/restaurant/**` (جديد), `src/app/erp/org/**` | المالية |
| 8 Frontend & UX | `factory/ui/i18n-split` | `src/components/**`, `src/lib/i18n.tsx`, `nav.ts`, `layout.tsx`, `login/**` | منطق الوحدات |
| 9 Database | `factory/db/staging-verification` | `database/**`, `supabase/**`, `scripts/**`, `src/lib/db*.ts`, `support/database.ts` | منطق الوحدات |
| 10 Security & IAM | `factory/security/tenant-picker` | `src/lib/auth/**`, `src/lib/iam/**`, `api/route.ts`, `env.ts`, `middleware.ts`, `security-headers.js`, `next.config.js` | منطق الوحدات |
| 11 QA | `factory/qa/ci-green` | `vitest.config.mts`, `.github/workflows/**`, ملفات اختبار جديدة | كود الإنتاج |
| 12 AI | `factory/ai/live-assistant` | `src/modules/ai/**`, `src/app/erp/ai/**`, `assistant.ts` | جداول الوحدات الأخرى |

## 4. الموجة الأولى الموصى بها (ثلاثة فروع معًا)

اخترتُها لأن ملفاتها لا تتقاطع ولا تحتاج قرارًا تجاريًا منك:

1. `factory/security/tenant-picker` — اختيار الشركة للمستخدم متعدد الشركات، وrate limiting، وCSRF، و`DATABASE_SSL=verify` إجباريًا في الإنتاج.
2. `factory/finance/ledger-screens` — شاشات دليل الحسابات والقيود والفترات وميزان المراجعة فوق API جاهز.
3. `factory/org/brand-branch-screens` — شاشات العلامات والفروع فوق API جاهز.

الفرعان 2 و3 يحتاجان مفاتيح i18n وروابط تنقل، وهي ملفات الدور 8. القاعدة: يُقدَّم الطلب في طابور `INTEGRATION_CHECKLIST.md` ويُنفَّذ في الشجرة الرئيسية **قبل** بدء الفرعين، حتى لا يتعارضا على `i18n.tsx` (2,703 سطر).

مؤجَّل حتى تقرر: المبيعات وPOS، الوصفات، HR والرواتب، قواعد AI الجديدة، والتحقق على staging حقيقي.

## 5. ترتيب الدمج

1. الفرع الأصغر أولًا، لتقليل إعادة الأساس على البقية.
2. قبل الدمج: `git rebase cursor/erp-finance-inventory-crm` داخل الـ worktree (لا `merge` حتى يبقى التاريخ مقروءًا، ولا `force push` مطلقًا).
3. البوابة الكاملة في الشجرة الرئيسية بعد كل دمج، لا بعد الدمج الأخير فقط.
4. `main` لا يستقبل شيئًا بلا موافقتك.

## 6. ما تحتاجه هذه الخطة قبل أن تصبح حقيقة

- تشغيل CI فعليًا على الفروع (يحتاج إذن دفع).
- قاعدة PostgreSQL staging منفصلة للتحقق (مُعطِّل إنتاج).
- قرارات المبيعات والتقييم والرواتب؛ بدونها تبقى أربعة أدوار من الاثني عشر بلا عمل قابل للتنفيذ.
