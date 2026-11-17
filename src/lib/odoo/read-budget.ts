/**
 * Time budget for optional Odoo reads.
 *
 * Odoo RPCs cannot be cancelled from here, so a slow read is abandoned rather than awaited: the
 * caller gets `fallback` once the budget is spent and the route keeps its own deadline. A read that
 * fails also yields the fallback. The late result (or error) is swallowed so it never surfaces as an
 * unhandled rejection.
 */
export interface BudgetResult<T> {
  value: T
  timedOut: boolean
}

export function withinBudget<T>(task: Promise<T>, budgetMs: number, fallback: T): Promise<BudgetResult<T>> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (result: BudgetResult<T>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => settle({ value: fallback, timedOut: true }), Math.max(0, budgetMs))
    task.then(
      (value) => settle({ value, timedOut: false }),
      () => settle({ value: fallback, timedOut: false }),
    )
  })
}
