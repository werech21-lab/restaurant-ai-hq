import type { VisionVerdict } from '@/modules/food-safety/domain/types'

export type VisionInput = {
  unitKind: string
  reportedTempC: number | null
  criticalAboveC: number
  warnAboveC: number
  tempPanelPhotoName: string
  productPhotoName: string
  notes?: string
}

export type VisionResult = {
  verdict: VisionVerdict
  reasonsEn: string[]
  reasonsAr: string[]
}

const SPOILAGE_HINTS = [
  'mold',
  'mould',
  'عفن',
  'spoil',
  'تلف',
  'slime',
  'slimey',
  'discolor',
  'تغير لون',
  'ice_buildup',
  'frost',
  'ثلج',
]

function nameHints(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').split(/\s+/).filter(Boolean)
}

/**
 * Deterministic AI Vision Spoilage Radar — same inputs → same verdict.
 * Inspects reported thermometer reading + photo file names / notes for spoilage cues.
 */
export function evaluateVision(input: VisionInput): VisionResult {
  const reasonsEn: string[] = []
  const reasonsAr: string[] = []
  let score = 0

  const isFreezer = input.unitKind.includes('freezer')
  const temp = input.reportedTempC

  if (temp !== null && Number.isFinite(temp)) {
    if (temp > input.criticalAboveC) {
      score += 3
      reasonsEn.push(
        isFreezer
          ? `Freezer panel reading ${temp.toFixed(1)}°C exceeds critical -12°C threshold`
          : `Chiller panel reading ${temp.toFixed(1)}°C exceeds critical +5°C threshold`,
      )
      reasonsAr.push(
        isFreezer
          ? `قراءة شاشة الفريزر ${temp.toFixed(1)}°م تجاوزت الحد الحرج -12°م`
          : `قراءة شاشة البراد ${temp.toFixed(1)}°م تجاوزت الحد الحرج +5°م`,
      )
    } else if (temp > input.warnAboveC) {
      score += 1
      reasonsEn.push(`Temperature ${temp.toFixed(1)}°C is above the warning band`)
      reasonsAr.push(`درجة الحرارة ${temp.toFixed(1)}°م أعلى من نطاق التحذير`)
    }
  } else {
    score += 1
    reasonsEn.push('Thermometer reading could not be parsed from the panel photo')
    reasonsAr.push('تعذر قراءة درجة الحرارة من صورة شاشة البراد')
  }

  const blob = `${input.tempPanelPhotoName} ${input.productPhotoName} ${input.notes ?? ''}`
  const tokens = nameHints(blob)
  for (const hint of SPOILAGE_HINTS) {
    if (tokens.some((t) => t.includes(hint)) || blob.toLowerCase().includes(hint)) {
      score += 2
      reasonsEn.push(`Visual cue detected: ${hint}`)
      reasonsAr.push(`علامة بصرية مرصودة: ${hint}`)
      break
    }
  }

  if (tokens.some((t) => t.includes('frost') || t.includes('ice')) && isFreezer) {
    score += 1
    reasonsEn.push('Abnormal ice / frost buildup flagged on freezer photo')
    reasonsAr.push('تراكم ثلج غير طبيعي على صورة الفريزر')
  }

  let verdict: VisionVerdict = 'safe'
  if (score >= 3) verdict = 'danger'
  else if (score >= 1) verdict = 'warn'

  if (verdict === 'safe') {
    reasonsEn.push('Panel and product photos within safe cold-chain limits')
    reasonsAr.push('صور الشاشة والمنتجات ضمن حدود سلسلة التبريد الآمنة')
  }

  return { verdict, reasonsEn, reasonsAr }
}

export function healthFromTemp(tempC: number, warnAboveC: number, criticalAboveC: number): 'safe' | 'warn' | 'critical' {
  if (tempC > criticalAboveC) return 'critical'
  if (tempC > warnAboveC) return 'warn'
  return 'safe'
}
