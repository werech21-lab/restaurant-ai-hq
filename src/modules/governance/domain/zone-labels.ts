/**
 * Display labels for delivery zones.
 * The internal zone name stays exactly as stored in the database (matching and filtering use it);
 * only what the user sees is mapped here.
 */
const ZONE_LABEL_AR: Record<string, string> = {}
const ZONE_LABEL_EN: Record<string, string> = {}

export const zoneLabelAr = (zone: string): string => ZONE_LABEL_AR[zone] ?? zone
export const zoneLabelEn = (zone: string): string => ZONE_LABEL_EN[zone] ?? zone
