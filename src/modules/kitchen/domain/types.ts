export type RecipeLine = { itemId: string; quantity: number }

export type Recipe = {
  id: string
  name: string
  yieldQuantity: number
  lines: RecipeLine[]
}

export type KitchenWaste = {
  id: string
  itemId: string
  warehouseId: string | null
  quantity: number
  wastedOn: string
  reason: string
  createdAt: string
}

export type KitchenProduction = {
  id: string
  recipeId: string
  warehouseId: string
  batches: number
  producedOn: string
  notes: string | null
  createdAt: string
}

export type ConsumptionResult = {
  id: string
  costMinor: number
  journalEntryId: string
}
