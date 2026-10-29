import { formatMinor } from '@/lib/money'

export type ContractSnapshot = {
  title: string
  counterparty: string
  startDate: string
  endDate: string
  valueMinor: number
  renewalAlertDays: number
}

export type ContractAnalysisDraft = {
  clausesSummaryAr: string
  risks: { code: string; detailAr: string }[]
  obligations: { party: 'company' | 'counterparty'; textAr: string }[]
  penaltyClausesAr: string
  negotiationRecommendationsAr: string
  riskScore: number
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function clampScore(value: number): number {
  return Math.min(100, Math.max(0, value))
}

/** Deterministic clause reading. The same contract and date always produce the same Arabic advice. */
export function analyzeContract(contract: ContractSnapshot, asOf: string): ContractAnalysisDraft {
  const value = formatMinor(contract.valueMinor)
  const renewalDue = contract.endDate <= addDays(asOf, contract.renewalAlertDays)
  let riskScore = 25
  if (contract.valueMinor >= 2_000_000) riskScore += 30
  if (renewalDue) riskScore += 25
  if (contract.endDate < asOf) riskScore += 20
  const risks: ContractAnalysisDraft['risks'] = []
  if (renewalDue) {
    risks.push({ code: 'renewal', detailAr: `ينتهي العقد في ${contract.endDate} خلال نافذة التنبيه (${contract.renewalAlertDays} يوماً).` })
  }
  if (contract.valueMinor >= 2_000_000) {
    risks.push({ code: 'value', detailAr: `القيمة ${value} د.ك تتجاوز ألفي دينار، فيلزم سقف زيادة سعرية مكتوب.` })
  }
  if (risks.length === 0) risks.push({ code: 'standard', detailAr: 'لا يظهر خطر مرتفع من التاريخ أو القيمة المخزّنين.' })
  return {
    clausesSummaryAr: `يلتزم ${contract.counterparty} بتنفيذ «${contract.title}» من ${contract.startDate} إلى ${contract.endDate} بقيمة ${value} د.ك.`,
    risks,
    obligations: [
      { party: 'company', textAr: 'تسديد المستحق خلال 30 يوماً من فاتورة مطابقة للبند، من دون زيادة غير مكتوبة.' },
      { party: 'counterparty', textAr: `${contract.counterparty} يلتزم بالجودة والموعد، ويتحمّل تكلفة الاستبدال عند العيب.` },
    ],
    penaltyClausesAr: 'كل أسبوع تأخير في التنفيذ يخصم 1% من قيمة البند المتأخر، وبحد 10%، مع حق الإيقاف.',
    negotiationRecommendationsAr: renewalDue
      ? 'لا تُجدَّد المدة تلقائياً. أضف سقف زيادة 5% وحق إنهاء خلال 15 يوماً إذا تكرر التأخير.'
      : 'أبقِ شرط الخصم الأسبوعي، واشترط موافقة خطية قبل أي تغيير في السعر.',
    riskScore: clampScore(riskScore),
  }
}
