/**
 * Backwards-compatible KWD formatter barrel delegating to canonical `@/lib/format`.
 * KWD has three decimal places: 35.05 is 35.050 and 18.95 is 18.950.
 */
export {
  UNAVAILABLE_DASH,
  formatKwd,
  formatKwdAmount,
  getUnavailableTooltip,
  type FormatKwdOptions,
  type FormatLocale,
} from './format'
