import { Decimal } from '@/server/ai/decimal'
import { ODOO_VERIFIED_ACTUALS_LABEL, PROPOSED_USER_INPUT_LABEL } from '@/server/ai/number-guard'
import { QURAIN_POS_CONFIG_IDS } from '@/lib/odoo/company-pos'
import { isExcludedOdooEntity, isExcludedRecordId } from '@/lib/odoo/excluded-entities'
import { kuwaitDateBoundsToOdooUtc } from '@/lib/odoo/pos-order-query'
import posRegistry from '@/lib/odoo/pos-registry.json'
import {
  areSkuBrandsCompatible,
  brandIdForPosRoot,
  hasCompatibleSizePackTokens,
  hasCrossBrandAmbiguity,
  inferBrandIdFromSkuName,
  resolveCanonicalBrandId,
  type CanonicalFeryalBrandId,
} from '@/lib/feryal/sku-matcher-guard'
import { logger } from '@/lib/logger'

/** Same ids as the company exclusion list: Jahra 25 and 39, inactive 40. */
export const ITEM_PRICING_EXCLUDED_POS_CONFIG_IDS = [25, 39, 40] as const
/** Delivery (Qurain), included by Odoo id. 36 is archived and is not in the registry. */
export const ITEM_PRICING_QURAIN_POS_CONFIG_IDS = QURAIN_POS_CONFIG_IDS
export const ITEM_PRICING_RPC_TIMEOUT_MS = 8_000
export const ITEM_PRICING_CHUNK_DAYS = 31
const EXCLUDED_POS_CATEGORY_ID = 150
const READ_ONLY_METHODS = new Set(['search_read', 'read', 'read_group', 'search_count', 'fields_get'])

export const COGS_UNAVAILABLE_REPLY =
  'standard_price is not readable for integration user 225. COGS and margin are not estimated.'

export interface ItemPricingRow {
  productId: number
  name: string
  qty: string
  netKwd: string
  unitPriceKwd: string | null
  categoryId: number | null
  brandId?: string | null
}

export interface ItemPricingRead {
  rows: ItemPricingRow[]
  domain: unknown[]
  groupby: ['product_id']
  chunks: number
  configIds: number[]
}

export interface PosCategoryRecord {
  id: number
  name: string
  parentId: number | null
}

interface RegistryBrand {
  id: string
  en?: string
  ar?: string
  posRoot?: string | null
}

interface RegistryRegister {
  location?: string
}

function registryBrands(): RegistryBrand[] {
  const brands = (posRegistry as { brands?: RegistryBrand[] }).brands
  return Array.isArray(brands) ? brands : []
}

function registryRegisters(): Record<string, RegistryRegister> {
  return (posRegistry as { registers?: Record<string, RegistryRegister> }).registers ?? {}
}

export function posRootForBrand(brandId: string | null): string | null {
  if (!brandId) return null
  const root = registryBrands().find((brand) => brand.id === brandId)?.posRoot
  return typeof root === 'string' && root.trim() ? root.trim() : null
}

export function brandLabel(brandId: string | null): { en: string; ar: string } | null {
  if (!brandId) return null
  const brand = registryBrands().find((item) => item.id === brandId)
  if (!brand) return null
  return { en: brand.en ?? brandId, ar: brand.ar ?? brand.en ?? brandId }
}

/**
 * Register ids for an item read. A branch is matched by its registry location id.
 * Names are never consulted. Excluded pos.config ids stay out. Qurain 24 and 36
 * are added by id for a company read and for the Qurain delivery location.
 */
export function itemPricingRegisterIds(branchLocation: string | null): number[] {
  const ids = new Set<number>()
  for (const [rawId, meta] of Object.entries(registryRegisters())) {
    const id = Number(rawId)
    if (!Number.isInteger(id) || id <= 0 || isExcludedRecordId('pos_config', id)) continue
    if (branchLocation && meta.location !== branchLocation) continue
    ids.add(id)
  }
  const includeQurain = branchLocation == null || branchLocation === 'qurain-delivery'
  if (includeQurain) {
    for (const id of ITEM_PRICING_QURAIN_POS_CONFIG_IDS) {
      if (!isExcludedRecordId('pos_config', id)) ids.add(id)
    }
  }
  return [...ids].sort((a, b) => a - b)
}

export function categoryIdsForPosRoot(
  categories: readonly PosCategoryRecord[],
  posRoot: string,
): number[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const excluded = (category: PosCategoryRecord | undefined): boolean => {
    if (!category) return false
    if (isExcludedRecordId('pos_category', category.id)) return true
    return isExcludedOdooEntity(category.name)
  }
  const rootOf = (id: number): PosCategoryRecord | null => {
    let current = byId.get(id)
    let guard = 0
    while (current?.parentId != null && guard < 12) {
      const parent = byId.get(current.parentId)
      if (!parent) break
      current = parent
      guard += 1
    }
    return current ?? null
  }
  const wanted = posRoot.trim().toLowerCase()
  const ids: number[] = []
  for (const category of categories) {
    if (excluded(category)) continue
    const root = rootOf(category.id)
    if (!root || excluded(root)) continue
    if (root.name.trim().toLowerCase() !== wanted) continue
    ids.push(category.id)
  }
  return [...new Set(ids)].sort((a, b) => a - b)
}

export function nonExcludedCategoryIds(categories: readonly PosCategoryRecord[]): number[] {
  return categories
    .filter((category) => category.id !== EXCLUDED_POS_CATEGORY_ID)
    .filter((category) => !isExcludedRecordId('pos_category', category.id))
    .filter((category) => !isExcludedOdooEntity(category.name))
    .map((category) => category.id)
    .sort((a, b) => a - b)
}

export function categoryBrandByIdMap(
  categories: readonly PosCategoryRecord[],
): Map<number, CanonicalFeryalBrandId> {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const excluded = (category: PosCategoryRecord | undefined): boolean => {
    if (!category) return false
    if (category.id === EXCLUDED_POS_CATEGORY_ID) return true
    if (isExcludedRecordId('pos_category', category.id)) return true
    return isExcludedOdooEntity(category.name)
  }
  const rootOf = (id: number): PosCategoryRecord | null => {
    let current = byId.get(id)
    let guard = 0
    while (current?.parentId != null && guard < 12) {
      const parent = byId.get(current.parentId)
      if (!parent) break
      current = parent
      guard += 1
    }
    return current ?? null
  }
  const result = new Map<number, CanonicalFeryalBrandId>()
  for (const category of categories) {
    if (excluded(category)) continue
    const root = rootOf(category.id)
    if (!root || excluded(root)) continue
    const resolved = brandIdForPosRoot(root.name) ?? resolveCanonicalBrandId(root.name)
    if (resolved) {
      result.set(category.id, resolved)
    }
  }
  return result
}

function shiftIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map((part) => Number(part))
  const next = new Date(Date.UTC(year, month - 1, day + days))
  const y = next.getUTCFullYear()
  const m = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d = String(next.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Inclusive Kuwait dates, each window at most `maxDays`, covering the range once. */
export function chunkInclusiveIsoDates(
  fromIso: string,
  toIso: string,
  maxDays = ITEM_PRICING_CHUNK_DAYS,
): Array<{ from: string; to: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromIso) || !/^\d{4}-\d{2}-\d{2}$/.test(toIso) || toIso < fromIso) {
    return []
  }
  const span = Math.max(1, maxDays)
  const chunks: Array<{ from: string; to: string }> = []
  let cursor = fromIso
  while (cursor <= toIso) {
    const end = shiftIso(cursor, span - 1)
    const to = end < toIso ? end : toIso
    chunks.push({ from: cursor, to })
    if (to === toIso) break
    cursor = shiftIso(to, 1)
  }
  return chunks
}

/**
 * `pos.order.config_id` is not stored. Lines are filtered through the session, and config is not a group.
 */
export function buildItemLineDomain(input: {
  fromUtc: string
  toExclusiveUtc: string
  configIds: readonly number[]
  categoryIds: readonly number[] | null
}): unknown[] {
  const domain: unknown[] = [
    ['order_id.date_order', '>=', input.fromUtc],
    ['order_id.date_order', '<', input.toExclusiveUtc],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
    ['order_id.session_id.config_id', 'in', [...input.configIds]],
    ['product_id.pos_categ_id', '!=', EXCLUDED_POS_CATEGORY_ID],
  ]
  if (input.categoryIds && input.categoryIds.length > 0) {
    domain.push(['product_id.pos_categ_id', 'in', [...input.categoryIds]])
  }
  return domain
}

export function revenueDeltaKwd(qty: string, currentPrice: string, proposedPrice: string): string | null {
  const quantity = Decimal.parse(qty)
  const current = Decimal.parse(currentPrice)
  const proposed = Decimal.parse(proposedPrice)
  if (!quantity || !current || !proposed || quantity.sign() === 0) return null
  return quantity.mul(proposed.sub(current)).roundHalfUp(3).canonical()
}

export function unitPriceKwd(netKwd: string, qty: string): string | null {
  const net = Decimal.parse(netKwd)
  const quantity = Decimal.parse(qty)
  if (!net || !quantity || quantity.sign() === 0) return null
  return net.div(quantity, 3)?.canonical() ?? null
}

function canonicalAmount(raw: string): string | null {
  const parsed = Decimal.parse(raw.replace(/,/g, ''))
  return parsed ? parsed.canonical() : null
}

export interface ProposedPrice {
  label: string
  amount: string
}

export function parseProposedPrices(question: string): ProposedPrice[] {
  const found: ProposedPrice[] = []
  const seen = new Set<string>()
  const push = (label: string, raw: string) => {
    const amount = canonicalAmount(raw)
    const name = label.replace(/\s+/g, ' ').trim()
    if (!amount || name.length < 2) return
    const key = `${name.toLowerCase()}|${amount}`
    if (seen.has(key)) return
    seen.add(key)
    found.push({ label: name, amount })
  }
  const patterns = [
    /proposed price for\s+([^:\n]+?)\s*[:=]\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
    /what[- ]if\s+([^0-9\n]+?)\s+(?:is|at|becomes|to)\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
    /سعر مقترح(?:\s+ل)?\s*([^0-9\n]+?)\s*[:=]?\s*([0-9][0-9,]*(?:\.[0-9]+)?)/gi,
  ]
  for (const pattern of patterns) {
    for (const match of question.matchAll(pattern)) {
      push(match[1] ?? '', match[2] ?? '')
    }
  }
  if (/proposed|what[- ]if|سعر/i.test(question)) {
    for (const line of question.split(/\n/)) {
      const match = line.match(/^\s*(.+?)\s+([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:kwd|د\.ك)?\s*$/i)
      if (!match) continue
      if (/proposed|what|سعر|show|menu|odoo|top/i.test(match[1] ?? '')) continue
      push(match[1] ?? '', match[2] ?? '')
    }
  }
  return found
}

function foldName(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim()
}

function stripLeadingCode(value: string): string {
  return value.replace(/^\s*\[[^\]]+\]\s*/, '').trim()
}

export function matchProposedPrice(
  proposal: ProposedPrice,
  rows: readonly ItemPricingRow[],
  options?: {
    rowBrand?: string | null
    contextBrand?: string | null
  },
): ItemPricingRow | null {
  const wanted = foldName(stripLeadingCode(proposal.label))
  if (wanted.length < 3) return null
  const rowBrandId =
    resolveCanonicalBrandId(options?.rowBrand) ??
    inferBrandIdFromSkuName(proposal.label) ??
    resolveCanonicalBrandId(options?.contextBrand)

  const hits = rows.filter((row) => {
    if (!row.name || isExcludedOdooEntity(row.name)) return false
    if (
      !areSkuBrandsCompatible({
        rowBrand: options?.rowBrand,
        sheetItemName: proposal.label,
        candidateBrand: row.brandId,
        candidateSkuName: row.name,
        contextBrand: options?.contextBrand,
      })
    ) {
      return false
    }
    if (!hasCompatibleSizePackTokens(proposal.label, row.name)) {
      return false
    }
    const name = foldName(stripLeadingCode(row.name))
    return name.length >= 3 && (name.includes(wanted) || wanted.includes(name))
  })
  if (hasCrossBrandAmbiguity(hits, rowBrandId)) return null
  return hits.length === 1 ? hits[0] ?? null : null
}

export function asksMarginOrCogs(question: string): boolean {
  return /(cogs|margin|standard_price|تكلفه|تكلفة|هامش)/i.test(question)
}

function formatGrouped(canonical: string, fractionDigits: number | null): string {
  const negative = canonical.startsWith('-')
  const body = negative ? canonical.slice(1) : canonical
  const [intPart, frac = ''] = body.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction =
    fractionDigits == null ? frac : (frac + '0'.repeat(fractionDigits)).slice(0, fractionDigits)
  const shown = fractionDigits == null ? (frac ? `${grouped}.${frac}` : grouped) : `${grouped}.${fraction}`
  return negative ? `-${shown}` : shown
}

export interface PricedItemLine {
  productId: number
  name: string
  qty: string
  netKwd: string
  unitPriceKwd: string | null
  proposed: string | null
  deltaKwd: string | null
}

export function priceItemRows(question: string, rows: readonly ItemPricingRow[]): PricedItemLine[] {
  const assigned = new Map<number, string>()
  for (const proposal of parseProposedPrices(question)) {
    const hit = matchProposedPrice(proposal, rows)
    if (hit && !assigned.has(hit.productId)) assigned.set(hit.productId, proposal.amount)
  }
  return rows.map((row) => {
    const proposed = assigned.get(row.productId) ?? null
    const delta =
      proposed && row.unitPriceKwd ? revenueDeltaKwd(row.qty, row.unitPriceKwd, proposed) : null
    return {
      productId: row.productId,
      name: row.name,
      qty: row.qty,
      netKwd: row.netKwd,
      unitPriceKwd: row.unitPriceKwd,
      proposed,
      deltaKwd: delta,
    }
  })
}

function pushNumber(target: number[], canonical: string | null): void {
  if (!canonical) return
  const parsed = Number(canonical)
  if (Number.isFinite(parsed)) target.push(parsed)
}

export function buildItemPricingAnswer(input: {
  question: string
  periodLabel: string
  brandNameAr: string | null
  rows: readonly ItemPricingRow[]
}): {
  reply: string
  toolNumbers: number[]
  allowedEntityNames: string[]
  structuredFacts: Record<string, unknown>
} {
  const priced = priceItemRows(input.question, input.rows)
    .slice()
    .sort((a, b) => {
      const left = Decimal.parse(b.netKwd)
      const right = Decimal.parse(a.netKwd)
      if (!left || !right) return 0
      return left.compare(right)
    })
  const toolNumbers: number[] = []
  const allowedEntityNames: string[] = []
  if (input.brandNameAr) allowedEntityNames.push(input.brandNameAr)
  let netSum = Decimal.parse('0') ?? Decimal.fromParts(0n, 0)
  let qtySum = Decimal.parse('0') ?? Decimal.fromParts(0n, 0)
  let deltaSum = Decimal.parse('0') ?? Decimal.fromParts(0n, 0)
  let pricedCount = 0
  for (const row of priced) {
    const net = Decimal.parse(row.netKwd)
    const qty = Decimal.parse(row.qty)
    if (net) netSum = netSum.add(net)
    if (qty) qtySum = qtySum.add(qty)
    if (row.deltaKwd) {
      const delta = Decimal.parse(row.deltaKwd)
      if (delta) {
        deltaSum = deltaSum.add(delta)
        pricedCount += 1
      }
    }
    allowedEntityNames.push(row.name)
  }
  const listed = priced.slice(0, 12)
  const scope = input.brandNameAr ? `علامة ${input.brandNameAr}` : 'كل العلامات'
  const itemText = listed
    .map((row) => {
      pushNumber(toolNumbers, row.qty)
      pushNumber(toolNumbers, row.netKwd)
      pushNumber(toolNumbers, row.unitPriceKwd)
      const qtyText = formatGrouped(row.qty, null)
      const netText = formatGrouped(row.netKwd, 3)
      const unitText = row.unitPriceKwd ? formatGrouped(row.unitPriceKwd, 3) : '—'
      return `${row.name} (الكمية ${qtyText} — ${ODOO_VERIFIED_ACTUALS_LABEL} ${netText} د.ك — السعر الحالي ${unitText} د.ك)`
    })
    .join('، ')
  const proposalLines = listed
    .filter((row) => row.proposed && row.deltaKwd)
    .map((row) => {
      pushNumber(toolNumbers, row.proposed)
      pushNumber(toolNumbers, row.deltaKwd)
      return `${row.name}: ${PROPOSED_USER_INPUT_LABEL} ${formatGrouped(row.proposed ?? '0', 3)} د.ك، فرق الإيراد ${formatGrouped(row.deltaKwd ?? '0', 3)} د.ك = الكمية × (المقترح − السعر الحالي)`
    })
  pushNumber(toolNumbers, String(priced.length))
  pushNumber(toolNumbers, netSum.canonical())
  pushNumber(toolNumbers, qtySum.canonical())
  if (pricedCount > 0) pushNumber(toolNumbers, deltaSum.roundHalfUp(3).canonical())
  const totalNet = formatGrouped(netSum.canonical(), 3)
  const totalQty = formatGrouped(qtySum.canonical(), null)
  const countText = formatGrouped(String(priced.length), null)
  const deltaClause =
    pricedCount > 0
      ? ` مجموع فرق الإيراد للأسعار المقترحة ${formatGrouped(deltaSum.roundHalfUp(3).canonical(), 3)} د.ك، محسوب من كميات Odoo فقط.`
      : ''
  const proposalBlock = proposalLines.length > 0 ? ` ${proposalLines.join(' ')}` : ''
  const cogs = asksMarginOrCogs(input.question)
  if (cogs) toolNumbers.push(225)
  const cogsLine = cogs ? ` ${COGS_UNAVAILABLE_REPLY}` : ''
  const reply = [
    `• الرقم: وفق pos.order.line (price_subtotal بدون الضريبة) للفترة ${input.periodLabel} (${scope})، ${countText} صنفاً بكمية ${totalQty} وصافي ${totalNet} د.ك. أعلى الأصناف: ${itemText}.${proposalBlock}${deltaClause}`,
    `• السبب من البيانات: الكميات والصافي من ${ODOO_VERIFIED_ACTUALS_LABEL}. أي سعر كتبه المستخدم موسوم ${PROPOSED_USER_INPUT_LABEL}، وفرق الإيراد = الكمية × (السعر المقترح − السعر الحالي).`,
    `• الإجراء المحدد: يراجع مدير العلامة الأسعار المقترحة مقابل الكميات المرحلة قبل اعتمادها.${cogsLine}`,
    `• الأثر المتوقع (تقدير): تقدير — فرق الإيراد أعلاه هو أثر السعر على الكمية المرحلة، وليس هامش ربح.`,
  ].join('\n')
  return {
    reply,
    toolNumbers,
    allowedEntityNames,
    structuredFacts: {
      model: 'pos.order.line',
      scope,
      itemCount: priced.length,
      itemQtyTotal: Number(qtySum.canonical()),
      itemNetTotalKwd: Number(netSum.canonical()),
      itemRows: priced.slice(0, 40).map((row) => ({
        productId: row.productId,
        name: row.name,
        qty: Number(row.qty),
        netKwd: Number(row.netKwd),
        unitPriceKwd: row.unitPriceKwd ? Number(row.unitPriceKwd) : null,
      })),
      userInputs: priced
        .filter((row) => row.proposed)
        .map((row) => ({
          label: PROPOSED_USER_INPUT_LABEL,
          productId: row.productId,
          name: row.name,
          amount: row.proposed,
        })),
    },
  }
}

interface OdooCall {
  model: string
  method: string
  args: unknown[]
  kwargs: Record<string, unknown>
  timeoutMs: number
}

export type ItemPricingExecute = (call: OdooCall) => Promise<unknown>

/** Item pricing never writes and never reads standard_price. */
export function assertItemPricingReadOnly(call: Pick<OdooCall, 'method' | 'args' | 'kwargs'>): void {
  if (!READ_ONLY_METHODS.has(call.method)) {
    logger.warn('feryal.item_pricing', { code: 'write_refused' })
    throw new Error('READ_ONLY')
  }
  const fields = JSON.stringify(call.args) + JSON.stringify(call.kwargs)
  if (fields.includes('standard_price')) {
    logger.warn('feryal.item_pricing', { code: 'standard_price_refused' })
    throw new Error('STANDARD_PRICE_UNAVAILABLE')
  }
}

async function executeReadOnly(execute: ItemPricingExecute, call: OdooCall): Promise<unknown> {
  assertItemPricingReadOnly(call)
  return execute(call)
}

interface RawGroup {
  product_id?: [number, string] | false
  price_subtotal?: number
  qty?: number
}

function isChunkTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: string }).name ?? ''
  const message = (error as { message?: string }).message ?? ''
  return name === 'AbortError' || name === 'TimeoutError' || /timeout|aborted/i.test(message)
}

function asCategories(payload: unknown): PosCategoryRecord[] {
  if (!Array.isArray(payload)) return []
  const rows: PosCategoryRecord[] = []
  for (const entry of payload) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as { id?: unknown; name?: unknown; parent_id?: unknown }
    if (typeof record.id !== 'number') continue
    const parent = Array.isArray(record.parent_id) ? record.parent_id[0] : null
    rows.push({
      id: record.id,
      name: typeof record.name === 'string' ? record.name : '',
      parentId: typeof parent === 'number' ? parent : null,
    })
  }
  return rows
}

function addCanonical(left: string, right: number | undefined): string {
  const base = Decimal.parse(left) ?? Decimal.fromParts(0n, 0)
  const extra = Decimal.parse(String(right ?? 0)) ?? Decimal.fromParts(0n, 0)
  return base.add(extra).canonical()
}

async function readGroups(
  execute: ItemPricingExecute,
  fromIso: string,
  toIso: string,
  configIds: readonly number[],
  categoryIds: readonly number[] | null,
  depth: number,
): Promise<RawGroup[] | null> {
  const bounds = kuwaitDateBoundsToOdooUtc(fromIso, toIso)
  const domain = buildItemLineDomain({
    fromUtc: bounds.fromUtc,
    toExclusiveUtc: bounds.toExclusiveUtc,
    configIds,
    categoryIds,
  })
  try {
    const payload = await executeReadOnly(execute, {
      model: 'pos.order.line',
      method: 'read_group',
      args: [domain, ['price_subtotal:sum', 'qty:sum'], ['product_id']],
      kwargs: { lazy: false, context: { tz: 'Asia/Kuwait' } },
      timeoutMs: ITEM_PRICING_RPC_TIMEOUT_MS,
    })
    return Array.isArray(payload) ? (payload as RawGroup[]) : []
  } catch (error) {
    if (!isChunkTimeout(error) || depth >= 2 || fromIso === toIso) {
      logger.warn('feryal.item_pricing', { code: depth >= 2 ? 'chunk_failed' : 'read_failed' })
      return null
    }
    const chunks = chunkInclusiveIsoDates(fromIso, toIso, Math.max(1, Math.ceil(daySpan(fromIso, toIso) / 2)))
    if (chunks.length < 2) return null
    const parts: RawGroup[] = []
    for (const chunk of chunks) {
      const rows = await readGroups(execute, chunk.from, chunk.to, configIds, categoryIds, depth + 1)
      if (!rows) return null
      parts.push(...rows)
    }
    return parts
  }
}

function daySpan(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map((part) => Number(part))
  const [ty, tm, td] = toIso.split('-').map((part) => Number(part))
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)
  return Math.round(ms / 86_400_000) + 1
}

export async function readItemPricingLines(input: {
  fromIso: string
  toIso: string
  branchLocation: string | null
  posRoot: string | null
  execute: ItemPricingExecute
}): Promise<ItemPricingRead | null> {
  const configIds = itemPricingRegisterIds(input.branchLocation)
  if (configIds.length === 0) return null
  let categories: PosCategoryRecord[] = []
  try {
    const payload = await executeReadOnly(input.execute, {
      model: 'pos.category',
      method: 'search_read',
      args: [[]],
      kwargs: { fields: ['id', 'name', 'parent_id'], limit: 500 },
      timeoutMs: ITEM_PRICING_RPC_TIMEOUT_MS,
    })
    categories = asCategories(payload)
  } catch (error) {
    if (!isChunkTimeout(error)) logger.warn('feryal.item_pricing', { code: 'category_read_failed' })
    return null
  }
  const categoryIds = input.posRoot
    ? categoryIdsForPosRoot(categories, input.posRoot)
    : nonExcludedCategoryIds(categories)
  if (input.posRoot && categoryIds.length === 0) {
    return { rows: [], domain: [], groupby: ['product_id'], chunks: 0, configIds }
  }
  const chunks = chunkInclusiveIsoDates(input.fromIso, input.toIso)
  const merged = new Map<number, { name: string; qty: string; net: string }>()
  for (const chunk of chunks) {
    const groups = await readGroups(input.execute, chunk.from, chunk.to, configIds, categoryIds, 0)
    if (!groups) return null
    for (const group of groups) {
      if (!Array.isArray(group.product_id) || typeof group.product_id[0] !== 'number') continue
      const productId = group.product_id[0]
      const name = String(group.product_id[1] ?? '').trim()
      if (!name || isExcludedOdooEntity(name)) continue
      const prev = merged.get(productId) ?? { name, qty: '0', net: '0' }
      prev.qty = addCanonical(prev.qty, group.qty)
      prev.net = addCanonical(prev.net, group.price_subtotal)
      merged.set(productId, prev)
    }
  }
  const scopedBrandId = input.posRoot ? brandIdForPosRoot(input.posRoot) : null
  const productCategoryById = new Map<number, number>()
  const productBrandById = new Map<number, CanonicalFeryalBrandId>()

  if (!input.posRoot && merged.size > 0) {
    const catBrandMap = categoryBrandByIdMap(categories)
    const productIds = [...merged.keys()]
    try {
      const prodPayload = await executeReadOnly(input.execute, {
        model: 'product.product',
        method: 'search_read',
        args: [[['id', 'in', productIds]]],
        kwargs: { fields: ['id', 'pos_categ_id'], limit: productIds.length },
        timeoutMs: ITEM_PRICING_RPC_TIMEOUT_MS,
      })
      if (Array.isArray(prodPayload)) {
        for (const entry of prodPayload) {
          if (!entry || typeof entry !== 'object') continue
          const rec = entry as { id?: unknown; pos_categ_id?: unknown }
          if (typeof rec.id !== 'number') continue
          let catId: number | null = null
          let catName = ''
          if (Array.isArray(rec.pos_categ_id) && typeof rec.pos_categ_id[0] === 'number') {
            catId = rec.pos_categ_id[0]
            catName = typeof rec.pos_categ_id[1] === 'string' ? rec.pos_categ_id[1] : ''
          } else if (typeof rec.pos_categ_id === 'number') {
            catId = rec.pos_categ_id
          }
          if (catId == null) continue
          if (
            catId === EXCLUDED_POS_CATEGORY_ID ||
            isExcludedRecordId('pos_category', catId) ||
            (catName && isExcludedOdooEntity(catName))
          ) {
            merged.delete(rec.id)
            continue
          }
          productCategoryById.set(rec.id, catId)
          const resolvedBrand =
            catBrandMap.get(catId) ?? (catName ? resolveCanonicalBrandId(catName) : null)
          if (resolvedBrand) {
            productBrandById.set(rec.id, resolvedBrand)
          }
        }
      }
    } catch {
      logger.warn('feryal.item_pricing', { code: 'product_category_lookup_skipped' })
    }
  }

  const bounds = kuwaitDateBoundsToOdooUtc(input.fromIso, input.toIso)
  const rows: ItemPricingRow[] = [...merged.entries()]
    .map(([productId, row]) => ({
      productId,
      name: row.name,
      qty: row.qty,
      netKwd: row.net,
      unitPriceKwd: unitPriceKwd(row.net, row.qty),
      categoryId: productCategoryById.get(productId) ?? null,
      brandId:
        scopedBrandId ??
        productBrandById.get(productId) ??
        inferBrandIdFromSkuName(row.name) ??
        null,
    }))
    .sort((a, b) => {
      const left = Decimal.parse(b.netKwd)
      const right = Decimal.parse(a.netKwd)
      if (!left || !right) return 0
      return left.compare(right)
    })
  return {
    rows,
    domain: buildItemLineDomain({
      fromUtc: bounds.fromUtc,
      toExclusiveUtc: bounds.toExclusiveUtc,
      configIds,
      categoryIds,
    }),
    groupby: ['product_id'],
    chunks: chunks.length,
    configIds,
  }
}

export async function fetchItemPricingFromOdoo(input: {
  fromIso: string
  toIso: string
  branchLocation: string | null
  posRoot: string | null
}): Promise<ItemPricingRead | null> {
  try {
    const mod = await import('@/lib/odoo-live-connector')
    return await readItemPricingLines({
      ...input,
      execute: (call) => {
        assertItemPricingReadOnly(call)
        return mod.executeOdooKw(call.model, call.method, call.args, call.kwargs, { timeoutMs: call.timeoutMs })
      },
    })
  } catch {
    logger.warn('feryal.item_pricing', { code: 'odoo_unavailable' })
    return null
  }
}
