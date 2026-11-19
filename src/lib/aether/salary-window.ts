/**
 * Founder-confirmed salary window, Kuwait calendar day of month, inclusive.
 * Salaries are paid between these days, and no later than the end day.
 */
export const SALARY_WINDOW_DAYS = { start: 5, end: 10 } as const

export function isSalaryWindowDay(isoDay: string): boolean {
  const dom = Number(isoDay.slice(8, 10))
  return dom >= SALARY_WINDOW_DAYS.start && dom <= SALARY_WINDOW_DAYS.end
}
