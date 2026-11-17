/**
 * Masks staff contact details before they reach logs. Logs keep enough to tell recipients apart
 * (recipient id, last digits, first letter and domain) but never the full number or address.
 */
const VISIBLE_MOBILE_DIGITS = 2
const MASK = '***'

export function maskMobileForLog(mobile: string): string {
  const digits = mobile.replace(/\D/g, '')
  if (digits.length <= VISIBLE_MOBILE_DIGITS) return MASK
  return `${MASK}${digits.slice(-VISIBLE_MOBILE_DIGITS)}`
}

export function maskEmailForLog(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return MASK
  return `${email[0]}${MASK}${email.slice(at)}`
}
