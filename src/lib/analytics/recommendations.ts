/** Approved executive recommendations: monthly impact is a management estimate (total KWD 6,840), not computed from Odoo. */
export type Priority = 'top' | 'high' | 'medium'
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
    issueEn: 'Drink attach rate on Keeta (6,267 orders) is only 4.8% and on Talabat Go 12.7%, against 41.2% in the shop.',
    issueAr: 'نسبة طلب المشروبات في كيتا (6,267 طلباً) 4.8% فقط وفي طلبات جو 12.7% مقابل 41.2% في المحل.',
    fixEn: 'Add a mandatory drink choice to combo meals on both platforms to lift the rate to 25%.',
    fixAr: 'إضافة خطوة اختيار مشروب إجبارية ضمن وجبات الكومبو في المنصتين لرفع النسبة إلى 25%.',
    impact: 2450,
  },
  {
    id: 'REC-02', priority: 'top',
    deptEn: 'Promotional discount control', deptAr: 'ضبط الخصومات التسويقية',
    issueEn: 'Keeta runs a 6.7% discount rate: KWD 2,544 of the KWD 4,152 total company discounts across 6,267 orders.',
    issueAr: 'كيتا تستهلك خصومات بنسبة 6.7% (2,544 د.ك من أصل 4,152 د.ك إجمالي خصومات الشركة عبر 6,267 طلباً).',
    fixEn: 'Stop the open menu-wide discount on Keeta and replace it with bundle offers capped at 3.5% (924 KWD a month).',
    fixAr: 'إيقاف الخصم المفتوح على المنيو في كيتا واستبداله بعروض وجبات مجمّعة بسقف خصم 3.5% (924 د.ك شهرياً).',
    impact: 1620,
  },
  {
    id: 'REC-03', priority: 'high',
    deptEn: 'Central kitchen (food cost)', deptAr: 'المطبخ المركزي (تكلفة الأغذية)',
    issueEn: 'Food cost drifted to 24.8% (KWD 41,438.856) from 24.0% because of chicken marinade waste.',
    issueAr: 'انحراف تكلفة الأغذية إلى 24.8% (41,438.856 د.ك) بدلاً من 24.0% نتيجة هدر تتبيل الدجاج.',
    fixEn: 'Pre-weigh marinade portions (140 g) and tie central-kitchen issues to daily POS sales.',
    fixAr: 'تطبيق وزن معياري مسبق لحصص التتبيل (140 جم) وربط صرف المطبخ المركزي بمبيعات نقاط البيع يومياً.',
    impact: 1336,
  },
  {
    id: 'REC-04', priority: 'high',
    deptEn: 'Maintenance & custody (Rabih)', deptAr: 'الصيانة والعهد (عهدة ربيع)',
    issueEn: 'Maintenance and custody spend reached KWD 10,707.930 from repeated fridge failures at Al-Kout and Salmiya.',
    issueAr: 'وصول مصاريف الصيانة والعهد إلى 10,707.930 د.ك بسبب تكرار أعطال ثلاجات فرعي الكوت والسالمية.',
    fixEn: 'Stop repeated cash repairs and approve a capital replacement (CapEx) of both fridges.',
    fixAr: 'إيقاف الصرف النقدي المتكرر على التصليح واعتماد استبدال رأسمالي (CapEx) للثلاجتين.',
    impact: 850,
  },
  {
    id: 'REC-05', priority: 'medium',
    deptEn: 'Menu engineering (364 items)', deptAr: 'هندسة المنيو (364 صنفاً)',
    issueEn: 'Only 32 items make 80% of sales while 332 items make 20% and add prep and storage waste.',
    issueAr: '32 صنفاً فقط تحقق 80% من المبيعات بينما 332 صنفاً تحقق 20% وترفع هدر التحضير والتخزين.',
    fixEn: 'Purge the 18 most sluggish Dog items and apply a +5% price calibration to 4 popular Plowhorses to ease prep pressure and lift margin.',
    fixAr: 'استبعاد أضعف 18 صنفاً ورفع أسعار 4 أصناف شعبية منخفضة الهامش بنسبة 5% لتخفيف ضغط التحضير ورفع الهامش.',
    impact: 584,
  },
]

export const RECS_TOTAL_KWD = RECS.reduce((sum, r) => sum + r.impact, 0)
