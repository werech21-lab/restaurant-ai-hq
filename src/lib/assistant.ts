import type { Locale } from '@/lib/i18n'
import type { SectionId } from '@/lib/nav'

export type Piece = { kind: 'text'; value: string } | { kind: 'num'; value: string }
export type Answer = {
  title: string
  paragraphs: Piece[][]
  bullets?: Piece[][]
  section?: SectionId
}

type Intent =
  | 'summary'
  | 'shuwaikh'
  | 'waste'
  | 'delivery'
  | 'inventory'
  | 'alerts'
  | 'decisions'
  | 'finance'
  | 'branches'
  | 'quality'
  | 'greeting'
  | 'fallback'

const text = (value: string): Piece => ({ kind: 'text', value })
const num = (value: string): Piece => ({ kind: 'num', value })

function normalize(input: string) {
  return input
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0600-\u06FFa-z0-9\s%]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const intents: { id: Intent; keys: string[] }[] = [
  { id: 'greeting', keys: ['مرحبا', 'السلام', 'hello', 'hi', 'hey'] },
  { id: 'summary', keys: ['ملخص', 'تنفيذي', 'executive', 'summary', 'brief', 'نظرة عامه'] },
  { id: 'shuwaikh', keys: ['شويخ', 'shuwaikh', 'ليش هامش', 'هامش الشويخ', 'هامش فرع', 'الهامش', 'هامش', 'margin', 'margin down', 'نازل', 'انخفض الهامش'] },
  { id: 'waste', keys: ['وضع الهدر', 'الهدر اليوم', 'الهدر', 'اعلى بند', 'waste', 'waste today', 'highest waste', 'دجاج مشوي'] },
  { id: 'delivery', keys: ['توصيل', 'تالي', 'ديليفري', 'delivery', 'tali', 'قارن شركات', 'شركات التوصيل', 'قارن بين', 'compare'] },
  { id: 'inventory', keys: ['مخزون', 'تموين', 'خس', 'زيت', 'inventory', 'stock', 'lettuce'] },
  { id: 'alerts', keys: ['تنبيه', 'تنبيهات', 'alerts', 'alert'] },
  { id: 'decisions', keys: ['قرار', 'قرارات', 'اعتماد', 'decision', 'pending', 'معلقه'] },
  { id: 'finance', keys: ['ماليه', 'ايراد', 'ميزان', 'ربح تشغيلي', 'finance', 'revenue', 'budget', 'profit'] },
  { id: 'branches', keys: ['قارن الفروع', 'الفروع', 'سالميه', 'حولي', 'الجهراء', 'branches', 'salmiya', 'hawally', 'jahra', 'compare the branches'] },
  { id: 'quality', keys: ['جوده', 'حراره', 'امتثال', 'quality', 'temperature', 'ثلاجه'] },
]

function matches(query: string, key: string) {
  const normalizedKey = normalize(key)
  if (normalizedKey.length <= 3) {
    return new RegExp(`(^|\\s)${normalizedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`).test(query)
  }
  return query.includes(normalizedKey)
}

function detect(query: string): Intent {
  const scores = intents.map((intent) => ({
    id: intent.id,
    score: intent.keys.reduce((sum, key) => sum + (matches(query, key) ? key.length : 0), 0),
  }))
  scores.sort((a, b) => b.score - a.score)
  if (!scores[0] || scores[0].score === 0) return 'fallback'
  if (scores[0].id === 'branches' && scores.some((row) => row.id === 'shuwaikh' && row.score >= scores[0].score)) return 'shuwaikh'
  return scores[0].id
}

function answers(locale: Locale): Record<Intent, Answer> {
  if (locale === 'en') {
    return {
      greeting: {
        title: 'Aether Assistant',
        paragraphs: [[text('Ask about branch margins, waste, delivery, inventory, alerts, or pending decisions. I answer from the sample data on this dashboard.')]],
      },
      summary: {
        title: 'Executive brief',
        paragraphs: [
          [text('Yesterday’s revenue was '), num('48,250'), text(' KWD, up '), num('+6.4%'), text('. Contribution margin is '), num('32.1%'), text(', down '), num('1.8'), text(' pt. Active branches are '), num('18/20'), text(', and system health is '), num('86'), text('.')],
          [text('This month, revenue is '), num('248,600'), text(' KWD ('), num('+5.8%'), text(') and operating profit is '), num('38,200'), text(' KWD ('), num('-9.1%'), text(').')],
        ],
        bullets: [
          [text('Alert: Shuwaikh margin fell from '), num('34.2%'), text(' to '), num('28.2%'), text('.')],
          [text('Alert: central-kitchen waste is '), num('8.4%'), text(' against a target under '), num('5%'), text('.')],
          [text('Alert: a new delivery contract is waiting for review.')],
          [text('Pending: waste-reduction project, target saving '), num('36,000'), text(' KWD.')],
          [text('Pending: renegotiate the chicken supplier, potential cut '), num('4.2%'), text('.')],
        ],
      },
      shuwaikh: {
        title: 'Shuwaikh margin',
        paragraphs: [
          [text('Branch 01, Burger House, is at '), num('28.2%'), text(' margin on '), num('28,400'), text(' KWD revenue. Two weeks ago the margin was '), num('34.2%'), text(', a drop of '), num('6.0'), text(' pt.')],
          [text('The most likely cause is the chicken price and the delivery commission, amplified because delivery is now most of the branch’s sales.')],
        ],
        bullets: [
          [text('Chicken price up '), num('9%'), text('. Confidence '), num('90%'), text(', supplier invoices. About '), num('2.5'), text(' pt of the drop.')],
          [text('Delivery commission moved from '), num('18%'), text(' to '), num('21%'), text('. Confidence '), num('94%'), text(', contract clause. About '), num('1.9'), text(' pt.')],
          [text('Delivery sales reached '), num('64%'), text('. Confidence '), num('74%'), text(', POS mix. This magnifies the commission.')],
          [text('Waste share of '), num('18%'), text(' is still a hypothesis and needs a field check.')],
        ],
      },
      waste: {
        title: 'Waste today',
        paragraphs: [[text('Central-kitchen waste is '), num('8.4%'), text(' today. The target is under '), num('5%'), text('. The highest item is grilled chicken.')]],
        bullets: [
          [text('Grilled chicken: '), num('42'), text(' kg, cost '), num('168'), text(' KWD.')],
          [text('Fresh vegetables: '), num('28'), text(' kg, cost '), num('56'), text(' KWD.')],
          [text('Prepared sauces: '), num('15'), text(' L, cost '), num('45'), text(' KWD.')],
        ],
      },
      delivery: {
        title: 'Delivery comparison',
        paragraphs: [[text('Tali is ahead of Delivery Co on commission, time, errors, and margin. Group delivery commissions are '), num('+20.1%'), text(' versus budget this month, and a new contract is still awaiting review.')]],
        bullets: [
          [text('Tali: fee '), num('18%'), text(', '), num('28'), text(' min, errors '), num('2.1%'), text(', margin '), num('14.2%'), text('.')],
          [text('Delivery Co: fee '), num('21%'), text(', '), num('34'), text(' min, errors '), num('4.8%'), text(', margin '), num('11.1%'), text('.')],
        ],
      },
      inventory: {
        title: 'Inventory',
        paragraphs: [[text('Stock value is '), num('186,400'), text(' KWD. '), num('7'), text(' items are below minimum and '), num('12'), text(' are close to expiry.')]],
        bullets: [
          [text('Fresh chicken: '), num('12'), text(' kg, below minimum.')],
          [text('Lettuce: '), num('4'), text(' kg, below minimum.')],
          [text('Frying oil: '), num('18'), text(' L, nearing expiry.')],
          [text('Garlic sauce: '), num('6'), text(' L, nearing expiry.')],
        ],
      },
      alerts: {
        title: 'Open alerts',
        paragraphs: [[text('Three alerts need attention today.')]],
        bullets: [
          [text('Shuwaikh margin dropped to '), num('28.2%'), text('.')],
          [text('Central-kitchen waste is above the '), num('5%'), text(' target, at '), num('8.4%'), text('.')],
          [text('A new delivery contract is waiting for review.')],
          [text('Quality: branch 5 fridge passed '), num('5°C'), text(', branch 3 scale needs calibration, and '), num('14'), text(' employees have not finished food-safety training.')],
        ],
      },
      decisions: {
        title: 'Pending decisions',
        paragraphs: [[text('Two decisions are waiting for your approval.')]],
        bullets: [
          [text('Central-kitchen waste reduction. Base case saving '), num('36,000'), text(' KWD a year, investment '), num('5,000'), text(' KWD, payback '), num('45'), text(' days.')],
          [text('Renegotiate the chicken supplier. Potential price cut '), num('4.2%'), text('.')],
        ],
      },
      finance: {
        title: 'Finance snapshot',
        paragraphs: [[text('Monthly revenue is '), num('248,600'), text(' KWD, up '), num('5.8%'), text('. Operating profit is '), num('38,200'), text(' KWD, down '), num('9.1%'), text('. Contribution margin is '), num('31.4%'), text(', down '), num('1.6'), text(' pt.')]],
        bullets: [
          [text('Largest variance: delivery commissions '), num('+20.1%'), text('.')],
          [text('Material cost is about '), num('+7.0%'), text(' versus budget.')],
          [text('Operating profit is about '), num('-11.4%'), text(' versus budget.')],
        ],
      },
      branches: {
        title: 'Branch margins',
        paragraphs: [[text('Group contribution margin is '), num('32.1%'), text('. Three branches are on the comparison board.')]],
        bullets: [
          [text('Salmiya 03, Pizza Plus: '), num('34,100'), text(' KWD, margin '), num('35.6%'), text(', excellent.')],
          [text('Shuwaikh 01, Burger House: '), num('28,400'), text(' KWD, margin '), num('28.2%'), text(', fair.')],
          [text('Jahra: margin '), num('31.4%'), text('.')],
          [text('Hawally 05, Burger House: '), num('22,600'), text(' KWD, margin '), num('24.1%'), text(', weak.')],
        ],
      },
      quality: {
        title: 'Quality and compliance',
        paragraphs: [[text('Three compliance items are open.')]],
        bullets: [
          [text('Branch 5 fridge went above '), num('5°C'), text('.')],
          [text('Branch 3 kitchen scale needs calibration.')],
          [text(''), num('14'), text(' employees have not finished food-safety training.')],
        ],
      },
      fallback: {
        title: 'I can look that up',
        paragraphs: [[text('I answer from the sample data already on this dashboard. Try a question about the Shuwaikh margin, today’s waste, delivery partners, inventory, alerts, or a quick executive brief.')]],
      },
    }
  }

  return {
    greeting: {
      title: 'مساعد Aether',
      paragraphs: [[text('اسأل عن هوامش الفروع، الهدر، التوصيل، المخزون، التنبيهات، أو القرارات المعلقة. أجاوب من البيانات المعروضة في اللوحة.')]],
    },
    summary: {
      title: 'ملخص تنفيذي',
      paragraphs: [
        [text('إيرادات الأمس '), num('48,250'), text(' د.ك، بارتفاع '), num('+6.4%'), text('. هامش المساهمة '), num('32.1%'), text('، بانخفاض '), num('1.8'), text(' نقطة. الفروع النشطة '), num('18/20'), text('، وصحة النظام '), num('86'), text('.')],
        [text('إيراد الشهر '), num('248,600'), text(' د.ك ('), num('+5.8%'), text(') والربح التشغيلي '), num('38,200'), text(' د.ك ('), num('-9.1%'), text(').')],
      ],
      bullets: [
        [text('تنبيه: هامش الشويخ نزل من '), num('34.2%'), text(' إلى '), num('28.2%'), text('.')],
        [text('تنبيه: هدر المطبخ المركزي '), num('8.4%'), text(' والهدف أقل من '), num('5%'), text('.')],
        [text('تنبيه: عقد توصيل جديد بانتظار المراجعة.')],
        [text('قرار معلّق: تخفيض الهدر، توفير مستهدف '), num('36,000'), text(' د.ك.')],
        [text('قرار معلّق: إعادة التفاوض مع مورد الدجاج، فرصة خفض '), num('4.2%'), text('.')],
      ],
    },
    shuwaikh: {
      title: 'هامش الشويخ',
      paragraphs: [
        [text('الفرع 01، برجر هاوس، هامشه الآن '), num('28.2%'), text(' على إيراد '), num('28,400'), text(' د.ك. قبل أسبوعين كان '), num('34.2%'), text('، أي انخفاض '), num('6.0'), text(' نقطة.')],
        [text('السبب الأرجح هو سعر الدجاج مع عمولة التوصيل، والأثر يكبر لأن معظم مبيعات الفرع صارت عبر التوصيل.')],
      ],
      bullets: [
        [text('سعر الدجاج ارتفع '), num('9%'), text('. الثقة '), num('90%'), text('، والدليل فواتير المورد. يفسّر نحو '), num('2.5'), text(' نقطة.')],
        [text('عمولة التوصيل انتقلت من '), num('18%'), text(' إلى '), num('21%'), text('. الثقة '), num('94%'), text('، والدليل بند العقد. يفسّر نحو '), num('1.9'), text(' نقطة.')],
        [text('مبيعات التوصيل وصلت '), num('64%'), text('. الثقة '), num('74%'), text('، من مزيج نقاط البيع. هذا يضخّم أثر العمولة.')],
        [text('حصة الهدر '), num('18%'), text(' ما زالت فرضية وتحتاج تحققاً ميدانياً.')],
      ],
    },
    waste: {
      title: 'الهدر اليوم',
      paragraphs: [[text('هدر المطبخ المركزي اليوم '), num('8.4%'), text('، والهدف أقل من '), num('5%'), text('. أعلى بند هو الدجاج المشوي.')]],
      bullets: [
        [text('دجاج مشوي: '), num('42'), text(' كجم، تكلفة '), num('168'), text(' د.ك.')],
        [text('خضروات طازجة: '), num('28'), text(' كجم، تكلفة '), num('56'), text(' د.ك.')],
        [text('صلصات جاهزة: '), num('15'), text(' لتراً، تكلفة '), num('45'), text(' د.ك.')],
      ],
    },
    delivery: {
      title: 'مقارنة التوصيل',
      paragraphs: [[text('تالي أفضل من ديليفري كو في العمولة والوقت والأخطاء والهامش. عمولات التوصيل للمجموعة هذا الشهر أعلى من الميزانية بـ '), num('+20.1%'), text('، وعقد جديد ما زال بانتظار المراجعة.')]],
      bullets: [
        [text('تالي: عمولة '), num('18%'), text('، وقت '), num('28'), text(' دقيقة، أخطاء '), num('2.1%'), text('، هامش '), num('14.2%'), text('.')],
        [text('ديليفري كو: عمولة '), num('21%'), text('، وقت '), num('34'), text(' دقيقة، أخطاء '), num('4.8%'), text('، هامش '), num('11.1%'), text('.')],
      ],
    },
    inventory: {
      title: 'المخزون',
      paragraphs: [[text('قيمة المخزون '), num('186,400'), text(' د.ك. هناك '), num('7'), text(' مواد تحت الحد الأدنى و'), num('12'), text(' مادة قاربت على الانتهاء.')]],
      bullets: [
        [text('دجاج طازج: '), num('12'), text(' كجم، تحت الحد.')],
        [text('خس: '), num('4'), text(' كجم، تحت الحد.')],
        [text('زيت القلي: '), num('18'), text(' لتراً، قارب الانتهاء.')],
        [text('صلصة الثوم: '), num('6'), text(' لترات، قاربت الانتهاء.')],
      ],
    },
    alerts: {
      title: 'التنبيهات المفتوحة',
      paragraphs: [[text('ثلاثة تنبيهات تحتاج متابعة اليوم، ومعها ملاحظات الجودة.')]],
      bullets: [
        [text('هامش الشويخ نزل إلى '), num('28.2%'), text('.')],
        [text('هدر المطبخ المركزي '), num('8.4%'), text(' فوق هدف '), num('5%'), text('.')],
        [text('عقد توصيل جديد بانتظار المراجعة.')],
        [text('الجودة: ثلاجة الفرع الخامس تجاوزت '), num('5°م'), text('، وميزان الفرع الثالث يحتاج معايرة، و'), num('14'), text(' موظفاً لم يكملوا تدريب سلامة الغذاء.')],
      ],
    },
    decisions: {
      title: 'قرارات معلّقة',
      paragraphs: [[text('قراران ينتظران اعتمادك.')]],
      bullets: [
        [text('تخفيض هدر المطبخ المركزي. السيناريو الأساسي يوفّر '), num('36,000'), text(' د.ك سنوياً، باستثمار '), num('5,000'), text(' د.ك، واسترداد خلال '), num('45'), text(' يوماً.')],
        [text('إعادة التفاوض مع مورد الدجاج. فرصة خفض '), num('4.2%'), text('.')],
      ],
    },
    finance: {
      title: 'لقطة مالية',
      paragraphs: [[text('إيراد الشهر '), num('248,600'), text(' د.ك، بارتفاع '), num('5.8%'), text('. الربح التشغيلي '), num('38,200'), text(' د.ك، بانخفاض '), num('9.1%'), text('. هامش المساهمة '), num('31.4%'), text('، بانخفاض '), num('1.6'), text(' نقطة.')]],
      bullets: [
        [text('أكبر انحراف: عمولات التوصيل '), num('+20.1%'), text('.')],
        [text('تكلفة المواد أعلى من الميزانية بنحو '), num('+7.0%'), text('.')],
        [text('الربح التشغيلي أقل من الميزانية بنحو '), num('-11.4%'), text('.')],
      ],
    },
    branches: {
      title: 'هوامش الفروع',
      paragraphs: [[text('هامش المساهمة للمجموعة '), num('32.1%'), text('. هذه مقارنة الفروع المعروضة في اللوحة.')]],
      bullets: [
        [text('السالمية 03، بيتزا بلس: '), num('34,100'), text(' د.ك، هامش '), num('35.6%'), text('، ممتاز.')],
        [text('الشويخ 01، برجر هاوس: '), num('28,400'), text(' د.ك، هامش '), num('28.2%'), text('، متوسط.')],
        [text('الجهراء: هامش '), num('31.4%'), text('.')],
        [text('حولي 05، برجر هاوس: '), num('22,600'), text(' د.ك، هامش '), num('24.1%'), text('، ضعيف.')],
      ],
    },
    quality: {
      title: 'الجودة والامتثال',
      paragraphs: [[text('ثلاثة بنود امتثال مفتوحة.')]],
      bullets: [
        [text('ثلاجة الفرع الخامس تجاوزت '), num('5°م'), text('.')],
        [text('ميزان مطبخ الفرع الثالث يحتاج معايرة.')],
        [text(''), num('14'), text(' موظفاً لم يكملوا تدريب سلامة الغذاء.')],
      ],
    },
    fallback: {
      title: 'أقدر أبحث لك',
      paragraphs: [[text('أجاوب من البيانات المعروضة في اللوحة. جرّب سؤالاً عن هامش الشويخ، هدر اليوم، شركات التوصيل، المخزون، التنبيهات، أو ملخصاً تنفيذياً سريعاً.')]],
    },
  }
}

const sectionFor: Partial<Record<Intent, SectionId>> = {
  summary: 'ceo',
  shuwaikh: 'intelligence',
  waste: 'kitchen',
  delivery: 'delivery',
  inventory: 'inventory',
  alerts: 'ceo',
  decisions: 'recommendations',
  finance: 'finance',
  branches: 'branches',
  quality: 'quality',
}

export function answerQuestion(query: string, locale: Locale): Answer {
  const intent = detect(normalize(query))
  const section = sectionFor[intent]
  return section ? { ...answers(locale)[intent], section } : answers(locale)[intent]
}

export function welcomeAnswer(locale: Locale): Answer {
  return answers(locale).greeting
}
