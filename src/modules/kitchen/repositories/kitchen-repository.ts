import type { Page } from '@/lib/api/cursor'
import { keysetClauses, toPage } from '@/lib/api/keyset'
import type { Queryable } from '@/lib/db'
import type { KitchenProduction, KitchenWaste, Recipe, RecipeLine } from '@/modules/kitchen/domain/types'
import type { ListQuery, RecordProductionInput, RecordWasteInput } from '@/modules/kitchen/schemas/kitchen'

type WasteRow = Omit<KitchenWaste, 'createdAt' | 'wastedOn'> & { createdAt: Date; wastedOn: string; sortValue?: string }
type ProductionRow = Omit<KitchenProduction, 'createdAt' | 'producedOn'> & { createdAt: Date; producedOn: string; sortValue?: string }

function waste(row: WasteRow): KitchenWaste {
  return { ...row, wastedOn: String(row.wastedOn).slice(0, 10), createdAt: row.createdAt.toISOString() }
}

function production(row: ProductionRow): KitchenProduction {
  return { ...row, producedOn: String(row.producedOn).slice(0, 10), createdAt: row.createdAt.toISOString() }
}

export async function listRecipes(tx: Queryable, tenantId: string): Promise<Recipe[]> {
  const recipes = await tx.query<Omit<Recipe, 'lines'>>(`select id, name, yield_quantity as "yieldQuantity" from recipes where tenant_id = $1 order by name, id`, [tenantId])
  if (recipes.rows.length === 0) return []
  const lines = await tx.query<RecipeLine & { recipeId: string }>(
    `select recipe_id as "recipeId", item_id as "itemId", quantity from recipe_lines where tenant_id = $1 and recipe_id = any($2::uuid[]) order by quantity, item_id`,
    [tenantId, recipes.rows.map((recipe) => recipe.id)]
  )
  const byRecipe = new Map<string, RecipeLine[]>()
  for (const line of lines.rows) {
    const list = byRecipe.get(line.recipeId) ?? []
    list.push({ itemId: line.itemId, quantity: line.quantity })
    byRecipe.set(line.recipeId, list)
  }
  return recipes.rows.map((recipe) => ({ ...recipe, lines: byRecipe.get(recipe.id) ?? [] }))
}

export async function findRecipeLines(tx: Queryable, tenantId: string, recipeId: string): Promise<RecipeLine[] | null> {
  const recipe = await tx.query<{ id: string }>(`select id from recipes where tenant_id = $1 and id = $2`, [tenantId, recipeId])
  if (!recipe.rows[0]) return null
  const lines = await tx.query<RecipeLine>(
    `select item_id as "itemId", quantity from recipe_lines where tenant_id = $1 and recipe_id = $2 order by item_id`,
    [tenantId, recipeId]
  )
  return lines.rows
}

export async function insertWaste(tx: Queryable, tenantId: string, userId: string, input: RecordWasteInput): Promise<KitchenWaste> {
  const result = await tx.query<WasteRow>(
    `insert into kitchen_waste (tenant_id, item_id, warehouse_id, quantity, wasted_on, reason, created_by)
     values ($1, $2, $3, $4, $5::date, $6, $7)
     returning id, item_id as "itemId", warehouse_id as "warehouseId", quantity, wasted_on::text as "wastedOn", reason, created_at as "createdAt"`,
    [tenantId, input.itemId, input.warehouseId, input.quantity, input.wastedOn, input.reason, userId]
  )
  return waste(result.rows[0])
}

export async function listWaste(tx: Queryable, tenantId: string, query: ListQuery): Promise<Page<KitchenWaste>> {
  const params: unknown[] = [tenantId]
  const keyset = keysetClauses({ sortKey: 'createdAt', column: { sql: '"createdAt"', cast: 'timestamptz' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<WasteRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (
       select id, item_id as "itemId", warehouse_id as "warehouseId", quantity, wasted_on::text as "wastedOn", reason, created_at as "createdAt"
       from kitchen_waste where tenant_id = $1
     ) x where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'createdAt', 'desc')
  return { data: page.data.map((row) => waste(row as WasteRow)), nextCursor: page.nextCursor }
}

export async function insertProduction(tx: Queryable, tenantId: string, userId: string, input: RecordProductionInput): Promise<KitchenProduction> {
  const result = await tx.query<ProductionRow>(
    `insert into kitchen_productions (tenant_id, recipe_id, warehouse_id, batches, produced_on, notes, created_by)
     values ($1, $2, $3, $4, $5::date, $6, $7)
     returning id, recipe_id as "recipeId", warehouse_id as "warehouseId", batches, produced_on::text as "producedOn", notes, created_at as "createdAt"`,
    [tenantId, input.recipeId, input.warehouseId, input.batches, input.producedOn, input.notes, userId]
  )
  return production(result.rows[0])
}

export async function listProductions(tx: Queryable, tenantId: string, query: ListQuery): Promise<Page<KitchenProduction>> {
  const params: unknown[] = [tenantId]
  const keyset = keysetClauses({ sortKey: 'createdAt', column: { sql: '"createdAt"', cast: 'timestamptz' }, direction: 'desc', cursor: query.cursor, params })
  params.push(query.limit + 1)
  const result = await tx.query<ProductionRow & { sortValue: string }>(
    `select x.*, ${keyset.selectValue} from (
       select id, recipe_id as "recipeId", warehouse_id as "warehouseId", batches, produced_on::text as "producedOn", notes, created_at as "createdAt"
       from kitchen_productions where tenant_id = $1
     ) x where true${keyset.where} order by ${keyset.orderBy} limit $${params.length}`,
    params
  )
  const page = toPage(result.rows, query.limit, 'createdAt', 'desc')
  return { data: page.data.map((row) => production(row as ProductionRow)), nextCursor: page.nextCursor }
}

export async function listWasteQuantities(tx: Queryable, tenantId: string): Promise<Array<{ itemId: string; quantity: number }>> {
  const result = await tx.query<{ itemId: string; quantity: number }>(
    `select item_id as "itemId", sum(quantity)::int as quantity from kitchen_waste where tenant_id = $1 group by item_id`,
    [tenantId]
  )
  return result.rows.map((row) => ({ itemId: row.itemId, quantity: Number(row.quantity) }))
}
