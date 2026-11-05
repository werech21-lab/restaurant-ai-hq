/**
 * Display labels for delivery zones.
 * The internal zone name stays exactly as stored in the database (matching and filtering use it);
 * only what the user sees is mapped here.
 */
const ZONE_LABEL_AR: Record<string, string> = {
  'أسواق القرين': 'مبارك الكبير',
  'القرين': 'مبارك الكبير',
}
const ZONE_LABEL_EN: Record<string, string> = {
  'Aswaq Al-Qurain': 'Mubarak Al-Kabeer',
  'Al-Qurain': 'Mubarak Al-Kabeer',
}

export const zoneLabelAr = (zone: string): string => ZONE_LABEL_AR[zone] ?? zone
export const zoneLabelEn = (zone: string): string => ZONE_LABEL_EN[zone] ?? zone
