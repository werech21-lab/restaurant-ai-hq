/**
 * Executive recommendations. Monthly impact values are management estimates; every fact quoted in
 * the issue text comes from the live Odoo sync (via the ledger).
 */
import { LEDGER, LEVERS } from '@/lib/aether/ledger'

export type Priority = 'top' | 'high' | 'medium'

const f3 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
const f0 = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 })
const lever = (id: (typeof LEVERS)[number]['id']) => LEVERS.find((l) => l.id === id)?.monthly ?? 0

export const RECS: {
  id: string
  priority: Priority
  deptEn: string; deptAr: string
  issueEn: string; issueAr: string
  fixEn: string; fixAr: string
  impact: number
}[] = [
  {
    id: 'REC-01', priority: 'top',
    deptEn: 'Delivery apps (Keeta & Talabat)', deptAr: 'تطبيقات التوصيل (كيتا وطلبات)',
    issueEn: `Odoo group AOV is ${f3(LEDGER.aov)} KWD across ${f0(LEDGER.orders)} orders; delivery combos are sold without a mandatory drink step.`,
    issueAr: `متوسط السلة في أودو ${f3(LEDGER.aov)} د.ك عبر ${f0(LEDGER.orders)} طلباً؛ وجبات الكومبو للتوصيل تُباع دون خطوة مشروب إلزامية.`,
    fixEn: `Add a mandatory drink choice to combo meals on Keeta and Talabat to lift AOV toward ${f3(LEDGER.aovTarget)} KWD.`,
    fixAr: `إضافة خطوة اختيار مشروب إجبارية ضمن وجبات الكومبو في كيتا وطلبات لرفع متوسط السلة نحو ${f3(LEDGER.aovTarget)} د.ك.`,
    impact: lever('beverage-attach'),
  },
  {
    id: 'REC-02', priority: 'top',
    deptEn: 'Promotional discount control', deptAr: 'ضبط الخصومات التسويقية',
    issueEn: `Keeta promotions in Odoo total ${f3(LEDGER.keetaDiscounts)} KWD (item sales − payments) of ${f3(LEDGER.discounts)} KWD group promotions and line discounts.`,
    issueAr: `خصومات كيتا في أودو ${f3(LEDGER.keetaDiscounts)} د.ك (المبيعات − المدفوعات) من أصل ${f3(LEDGER.discounts)} د.ك خصومات وعروض المجموعة.`,
    fixEn: `Replace the open Keeta discount with bundle offers capped at ${LEDGER.keetaCapPct}% (${f3(LEDGER.keetaCapKwd)} KWD a month).`,
    fixAr: `استبدال الخصم المفتوح في كيتا بعروض وجبات مجمّعة بسقف ${LEDGER.keetaCapPct}% (${f3(LEDGER.keetaCapKwd)} د.ك شهرياً).`,
    impact: lever('keeta-cap'),
  },
  {
    id: 'REC-03', priority: 'high',
    deptEn: 'Central kitchen (food cost)', deptAr: 'المطبخ المركزي (تكلفة الأغذية)',
    issueEn: `Odoo food cost is ${LEDGER.cogsPct}% (KWD ${f3(LEDGER.cogs)}) against the ${LEDGER.cogsTargetPct}% target; central-kitchen costs are not charged to locations.`,
    issueAr: `تكلفة الأغذية في أودو ${LEDGER.cogsPct}% (${f3(LEDGER.cogs)} د.ك) مقابل المستهدف ${LEDGER.cogsTargetPct}%؛ تكاليف المطبخ المركزي غير محمّلة على المواقع.`,
    fixEn: 'Pre-weigh marinade portions (140 g) and tie central-kitchen issues to daily POS sales per location.',
    fixAr: 'تطبيق وزن معياري مسبق لحصص التتبيل (140 جم) وربط صرف المطبخ المركزي بمبيعات نقاط البيع اليومية لكل موقع.',
    impact: lever('ardiya-yield'),
  },
  {
    id: 'REC-04', priority: 'high',
    deptEn: 'Maintenance & custody', deptAr: 'الصيانة والعهد',
    issueEn: `Maintenance custody reached KWD ${f3(LEDGER.maintCustody)} across ${LEDGER.maintEntries} expense records from repeated fridge failures at Al-Kout Mall and Salmiya.`,
    issueAr: `بلغت عهدة الصيانة ${f3(LEDGER.maintCustody)} د.ك عبر ${LEDGER.maintEntries} سجل مصروفات بسبب تكرار أعطال الثلاجات في مجمع الكوت والسالمية.`,
    fixEn: 'Stop repeated cash repairs and approve a capital replacement (CapEx) of both fridges.',
    fixAr: 'إيقاف الصرف النقدي المتكرر على التصليح واعتماد استبدال رأسمالي للثلاجتين.',
    impact: lever('chiller-overhaul'),
  },
  {
    id: 'REC-05', priority: 'medium',
    deptEn: `Menu engineering (${LEDGER.menuItems} items)`, deptAr: `هندسة المنيو (${LEDGER.menuItems} صنفاً)`,
    issueEn: `Only ${LEDGER.topItems} of ${LEDGER.menuItems} items sold in Odoo make 80% of sales; the long tail adds prep and storage waste.`,
    issueAr: `${LEDGER.topItems} صنفاً فقط من أصل ${LEDGER.menuItems} صنفاً مبيعاً في أودو تحقق 80% من المبيعات؛ والذيل الطويل يرفع هدر التحضير والتخزين.`,
    fixEn: `Purge the ${LEDGER.menuDogsPurge} most sluggish Dog items and apply +5% to ${LEDGER.menuPlowhorsesReprice} popular Plowhorses.`,
    fixAr: `استبعاد أضعف ${LEDGER.menuDogsPurge} صنفاً ورفع أسعار ${LEDGER.menuPlowhorsesReprice} أصناف شعبية منخفضة الهامش بنسبة 5%.`,
    impact: lever('menu-matrix'),
  },
]

export const RECS_TOTAL_KWD = RECS.reduce((sum, r) => sum + r.impact, 0)
