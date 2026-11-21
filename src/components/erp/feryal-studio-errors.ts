/**
 * Failure copy shown in Feryal studio. Always Arabic, including when the UI locale is English.
 * File-extension text is the one message that still contains Latin tokens.
 */

export const FERYAL_VISUAL_ATTACHMENT_ERROR_AR = 'تعذر تجهيز المرفق البصري.' as const

export const FERYAL_PRICE_SHEET_EXTRACT_ERROR_AR =
  'تعذّر استخراج جدول الأسعار من الملف المرفق — تحقق من الأعمدة أو جرّب تدوير الصورة 90°.' as const

export const FERYAL_DOCUMENT_UPLOAD_CONNECTION_ERROR_AR =
  'تعذّر الاتصال بخدمة استخراج الجداول — أعد المحاولة.' as const

export const FERYAL_UNSUPPORTED_INTAKE_FILE_ERROR_AR =
  'الصيغة غير مدعومة — يرجى رفع ملف Excel (.xlsx) أو CSV (.csv) أو صورة قائمة (.jpg / .png / .webp).' as const

export const FERYAL_REMATCH_LAST_30_DAYS_ERROR_AR =
  'تعذّر إعادة مطابقة الأصناف على آخر 30 يوماً — يرجى المحاولة مرة أخرى.' as const

export const FERYAL_REMATCH_CONNECTION_ERROR_AR =
  'تعذّر الاتصال لإعادة المطابقة على آخر 30 يوماً — أعد المحاولة.' as const

export const FERYAL_RERUN_SIMULATION_ERROR_AR =
  'تعذّر إعادة التشغيل على آخر 30 يوماً — يرجى المحاولة مرة أخرى.' as const

export const FERYAL_GOVERNANCE_ALERTS_LOAD_ERROR_AR = 'تعذّر جلب تنبيهات الحوكمة حالياً' as const

export const FERYAL_QUERY_LOG_LOAD_ERROR_AR = 'تعذّر تحميل سجل الاستعلامات حالياً' as const

/** Studio failures whose Arabic copy must not contain Latin letters. */
export const FERYAL_LATIN_FREE_STUDIO_ERRORS = [
  FERYAL_VISUAL_ATTACHMENT_ERROR_AR,
  FERYAL_PRICE_SHEET_EXTRACT_ERROR_AR,
  FERYAL_DOCUMENT_UPLOAD_CONNECTION_ERROR_AR,
  FERYAL_REMATCH_LAST_30_DAYS_ERROR_AR,
  FERYAL_REMATCH_CONNECTION_ERROR_AR,
  FERYAL_RERUN_SIMULATION_ERROR_AR,
  FERYAL_GOVERNANCE_ALERTS_LOAD_ERROR_AR,
  FERYAL_QUERY_LOG_LOAD_ERROR_AR,
] as const
