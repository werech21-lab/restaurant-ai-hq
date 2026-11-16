/** KWD has three decimal places. 35.05 is 35.050 and 18.95 is 18.950. */
export function formatKwdAmount(value: number): string {
  const clean = Number.isFinite(value) ? value : 0
  return clean.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })
}
