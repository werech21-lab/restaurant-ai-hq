import { formatMinor } from '@/lib/money'

export function radarAdvice(competitor: string, item: string, ourMinor: number, theirMinor: number): { insightAr: string; counterAr: string } {
  const gap = Math.abs(ourMinor - theirMinor)
  const gapText = formatMinor(gap)
  if (ourMinor > theirMinor) {
    return {
      insightAr: `سعرنا أعلى من ${competitor} على ${item} بفارق ${gapText} د.ك.`,
      counterAr: `قدّم عرضاً محدوداً بخفض ${gapText} د.ك على ${item} لأسبوع، ثم قِس حجم الطلب.`,
    }
  }
  if (ourMinor < theirMinor) {
    return {
      insightAr: `سعرنا أقل من ${competitor} على ${item} بفارق ${gapText} د.ك.`,
      counterAr: `ثبّت السعر الحالي لـ ${item} وركّز الرسالة على سرعة التوريد لا على خصم إضافي.`,
    }
  }
  return {
    insightAr: `سعرنا يطابق ${competitor} على ${item}.`,
    counterAr: `ميّز ${item} بشرط خدمة مكتوب بدل خفض السعر.`,
  }
}
