export type LoginErrorPayload = {
  errorAr?: string
  errorEn?: string
  error?: string
  reason?: string
  retryAfterSeconds?: number
}

export type LoginErrorMessage = { ar: string; en: string }

const INVALID: LoginErrorMessage = {
  ar: 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.',
  en: 'Invalid credentials. Please check your email and password.',
}

export const NO_ACCESS_MESSAGE: LoginErrorMessage = {
  ar: 'هذا الحساب غير مدرج في قائمة الدخول. اطلب من مسؤول النظام إضافته قبل المحاولة مرة أخرى.',
  en: 'This account is not on the access list. Ask an administrator to add it before trying again.',
}

export function messageForLoginReason(reason: string | undefined | null): LoginErrorMessage | null {
  if (reason === 'no_access') return NO_ACCESS_MESSAGE
  return null
}

/**
 * Maps a failed /api/auth/login response to a bilingual message. A 429 (too many attempts) and a
 * 403 (cross-origin refused) must never be shown as "invalid credentials".
 */
export function resolveLoginErrorMessage(
  status: number,
  data: LoginErrorPayload | null | undefined,
): LoginErrorMessage {
  const payload = data ?? {}
  if (payload.reason === 'no_access') return NO_ACCESS_MESSAGE
  if (status === 429) {
    const seconds = Number(payload.retryAfterSeconds)
    const minutes = Number.isFinite(seconds) && seconds > 0 ? Math.max(1, Math.ceil(seconds / 60)) : null
    return {
      ar: minutes
        ? `تم تجاوز الحد المسموح للمحاولات — يرجى المحاولة بعد ${minutes} دقيقة.`
        : 'تم تجاوز الحد المسموح للمحاولات — يرجى الانتظار قليلاً ثم المحاولة مجدداً.',
      en: minutes
        ? `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
        : 'Too many attempts. Please wait before trying again.',
    }
  }
  if (status === 403) {
    return {
      ar: payload.errorAr || 'تم رفض طلب تسجيل الدخول من مصدر خارجي غير مصرح به.',
      en: payload.errorEn || payload.error || 'Login request refused: it did not come from the AetherBI site.',
    }
  }
  return {
    ar: payload.errorAr || INVALID.ar,
    en: payload.errorEn || payload.error || INVALID.en,
  }
}
