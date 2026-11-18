/**
 * Warehouse valuation: unit cost per product and how much of the stock / moves it covers.
 *
 * A product's cost comes from the first real Odoo source that has one:
 *   1. product.product.standard_price (company-dependent; read with the company context);
 *   2. stock.valuation.layer (Σ value ÷ Σ quantity);
 *   3. purchase.order.line (Σ subtotal ÷ Σ quantity, confirmed / done orders).
 * A product with none of these has no cost — never 0.000. A KWD total is shown only when the
 * costed products cover at least {@link VALUE_COVERAGE_THRESHOLD} of the quantity behind it;
 * otherwise the section is «غير متاح» and only quantities are shown.
 */

export type CostSource = 'standard_price' | 'valuation_layer' | 'purchase_price'

export interface ProductCost {
  unitCostKwd: number
  source: CostSource
}

export const VALUE_COVERAGE_THRESHOLD = 0.95

const positive = (n: unknown): number | null => {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? v : null
}

export function resolveProductCosts(
  productIds: readonly number[],
  sources: {
    standardPrice: ReadonlyMap<number, number>
    valuationLayer: ReadonlyMap<number, { value: number; quantity: number }>
    purchase: ReadonlyMap<number, { subtotal: number; quantity: number }>
  },
): Map<number, ProductCost> {
  const out = new Map<number, ProductCost>()
  for (const pid of productIds) {
    const sp = positive(sources.standardPrice.get(pid))
    if (sp !== null) {
      out.set(pid, { unitCostKwd: sp, source: 'standard_price' })
      continue
    }
    const layer = sources.valuationLayer.get(pid)
    const layerQty = positive(layer?.quantity)
    const layerVal = positive(layer?.value)
    if (layerQty !== null && layerVal !== null) {
      out.set(pid, { unitCostKwd: layerVal / layerQty, source: 'valuation_layer' })
      continue
    }
    const po = sources.purchase.get(pid)
    const poQty = positive(po?.quantity)
    const poSub = positive(po?.subtotal)
    if (poQty !== null && poSub !== null) {
      out.set(pid, { unitCostKwd: poSub / poQty, source: 'purchase_price' })
    }
  }
  return out
}

/** Running coverage: quantity whose product has a known cost vs all quantity. */
export class CoverageCounter {
  private known = 0
  private total = 0
  add(qty: number, costKnown: boolean): void {
    const q = Math.abs(Number(qty) || 0)
    this.total += q
    if (costKnown) this.known += q
  }
  /** 0..100 (one decimal); 100 when there is no quantity at all. */
  pct(): number {
    if (this.total <= 0) return 100
    return Math.round((this.known / this.total) * 1000) / 10
  }
  valued(): boolean {
    return this.total <= 0 || this.known / this.total >= VALUE_COVERAGE_THRESHOLD
  }
}

export interface WarehouseValuationSummary {
  /** Products in the payload with a known cost / without one. */
  costedProducts: number
  uncostedProducts: number
  sources: Record<CostSource, number>
  onHandCoveragePct: number
  movesCoveragePct: number
  scrapCoveragePct: number
  /** KWD totals for the section are real (coverage ≥ threshold). */
  onHandValued: boolean
  movesValued: boolean
  scrapValued: boolean
}
