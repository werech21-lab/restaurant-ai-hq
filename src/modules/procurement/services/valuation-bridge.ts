import type { AuthContext } from '@/lib/auth/context'
import type { Queryable } from '@/lib/db'
import { applyPriceVarianceWithin } from '@/modules/inventory'

type VarianceLine = { itemId: string; quantity: number; unitCostMinor: number; poUnitCostMinor: number }

/**
 * Revalues stock still on hand for this document and returns the fils that should move between the variance account and
 * inventory on the new journal. A positive result is a debit to inventory on an invoice and a credit to inventory on a
 * credit note. Order price returns 0 and writes nothing.
 */
export async function reclassVariance(
  tx: Queryable,
  auth: AuthContext,
  referenceType: 'supplier_invoice' | 'supplier_credit_note',
  referenceId: string,
  lines: readonly VarianceLine[],
  direction: 'invoice' | 'credit'
): Promise<number> {
  const sign = direction === 'invoice' ? 1 : -1
  const pool = await applyPriceVarianceWithin(
    tx,
    auth,
    referenceType,
    referenceId,
    lines.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      unitVarianceMinor: sign * (line.unitCostMinor - line.poUnitCostMinor),
    }))
  )
  return sign === 1 ? pool : -pool
}
