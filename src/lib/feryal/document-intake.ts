import 'server-only'

import { randomUUID } from 'node:crypto'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import {
  APPROVED_FERYAL_BRAND_LIST,
  ALL_FERYAL_BRANCHES,
  normalizeArabicText,
  resolveFeryalQuestionPeriod,
  validateFeryalContextDefaults,
  type ApprovedFeryalBranchId,
  type ApprovedFeryalBrandId,
} from '@/lib/feryal-intent'
import {
  EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
  formatKwd3,
  normalizeIntakeSkuKey,
  normalizePriceInputText,
  recomputeIntakeRowAnomalies,
  summarizeDocumentIntakeRows,
  type DocumentIntakeDraft,
  type DocumentIntakeFileKind,
  type DocumentIntakeRow,
  type ExtractedProposedOption,
  type RejectedVariantHint,
} from '@/lib/feryal/document-intake-types'
import {
  fetchItemPricingFromOdoo,
  matchProposedPrice,
  posRootForBrand,
  unitPriceKwd,
  type ItemPricingRow,
} from '@/lib/feryal/item-pricing'
import {
  areSkuBrandsCompatible,
  checkPriceSanityDeviation,
  hasCompatibleSizePackTokens,
  hasCrossBrandAmbiguity,
  inferBrandIdFromSkuName,
  resolveCanonicalBrandId,
} from '@/lib/feryal/sku-matcher-guard'
import { logger } from '@/lib/logger'
import { isExcludedOdooEntity } from '@/lib/odoo/excluded-entities'
import { Decimal } from '@/server/ai/decimal'
import { readCouncilKeys, type CouncilKeys } from '@/server/ai/env'
import { resolveCouncilModels, type CouncilModels } from '@/server/ai/models'

export const MAX_DOCUMENT_INTAKE_BYTES = 10 * 1024 * 1024
const VISION_EXTRACTION_TIMEOUT_MS = 25_000
const MIN_PROVIDER_KEY_LENGTH = 20

export class DocumentIntakeError extends Error {
  constructor(
    readonly code:
      | 'FILE_REQUIRED'
      | 'EMPTY_FILE'
      | 'FILE_TOO_LARGE'
      | 'UNSUPPORTED_FILE_TYPE'
      | 'EMPTY_SPREADSHEET'
      | 'INVALID_SPREADSHEET'
      | 'VISION_PROVIDER_UNAVAILABLE'
      | 'VISION_PROVIDER_ERROR'
      | 'VISION_INVALID_SCHEMA',
    message: string,
    readonly httpStatus: number,
  ) {
    super(message)
    this.name = 'DocumentIntakeError'
  }
}

export interface DetectedIntakeFile {
  fileKind: DocumentIntakeFileKind
  normalizedMime: string
}

const IMAGE_MIME_BY_EXT: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

const GENERIC_BINARY_MIMES = new Set(['', 'application/octet-stream'])
const ALLOWED_XLSX_MIMES = new Set([
  ...GENERIC_BINARY_MIMES,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
])
const ALLOWED_CSV_MIMES = new Set([
  ...GENERIC_BINARY_MIMES,
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
])
const ALLOWED_IMAGE_MIMES: Readonly<Record<string, ReadonlySet<string>>> = {
  '.jpg': new Set([...GENERIC_BINARY_MIMES, 'image/jpeg', 'image/jpg']),
  '.jpeg': new Set([...GENERIC_BINARY_MIMES, 'image/jpeg', 'image/jpg']),
  '.png': new Set([...GENERIC_BINARY_MIMES, 'image/png']),
  '.webp': new Set([...GENERIC_BINARY_MIMES, 'image/webp']),
}

export function detectIntakeFileKind(
  fileName: string,
  mimeType?: string | null,
): DetectedIntakeFile | null {
  const trimmedName = fileName.trim()
  const baseMime = (mimeType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
  const dotIdx = trimmedName.lastIndexOf('.')
  const ext = dotIdx >= 0 ? trimmedName.slice(dotIdx).toLowerCase() : ''

  if (ext) {
    if (ext === '.xlsx') {
      if (!ALLOWED_XLSX_MIMES.has(baseMime)) return null
      return {
        fileKind: 'xlsx',
        normalizedMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }
    }
    if (ext === '.csv') {
      if (!ALLOWED_CSV_MIMES.has(baseMime)) return null
      return { fileKind: 'csv', normalizedMime: 'text/csv' }
    }
    const allowedImgMimes = ALLOWED_IMAGE_MIMES[ext]
    const canonicalImgMime = IMAGE_MIME_BY_EXT[ext]
    if (allowedImgMimes && canonicalImgMime) {
      if (!allowedImgMimes.has(baseMime)) return null
      return { fileKind: 'image', normalizedMime: canonicalImgMime }
    }
    return null
  }

  if (baseMime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return { fileKind: 'xlsx', normalizedMime: baseMime }
  }
  if (baseMime === 'text/csv' || baseMime === 'application/csv') {
    return { fileKind: 'csv', normalizedMime: 'text/csv' }
  }
  if (baseMime === 'image/jpeg' || baseMime === 'image/jpg') {
    return { fileKind: 'image', normalizedMime: 'image/jpeg' }
  }
  if (baseMime === 'image/png' || baseMime === 'image/webp') {
    return { fileKind: 'image', normalizedMime: baseMime }
  }

  return null
}

export interface RawExtractedIntakeRow {
  brand: string | null
  itemName: string
  sheetCurrentPriceKwd: string | null
  proposedOptions: ExtractedProposedOption[]
}

function normalizeHeaderToken(raw: string): string {
  return normalizeArabicText(raw)
    .replace(/[_-]+/g, ' ')
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isBrandHeader(norm: string): boolean {
  return /^(brand|brands|concept|brand name|العلامه|علامه|العلامه التجاريه|البراند|براند|المطعم)$/.test(
    norm,
  )
}

function isItemHeader(norm: string): boolean {
  return /^(item|items|item name|menu item|product|products|product name|sku|sku name|dish|dish name|name|description|الصنف|اسم الصنف|الاصناف|المنتج|اسم المنتج|المنتجات|الطبق|اسم الطبق|البند|الوصف)$/.test(
    norm,
  )
}

function isCurrentPriceHeader(norm: string): boolean {
  return (
    /^(current|current price|current kwd|old price|existing price|actual price|pos price|base price|price now|السعر الحالي|سعر حالي|حالي|السعر القديم|السعر الفعلي|سعر نقاط البيع)$/.test(
      norm,
    ) || /\b(current price|old price|actual price)\b/.test(norm) || /(السعر الحالي|سعر حالي|السعر الفعلي)/.test(norm)
  )
}

function isBareGenericPriceHeader(norm: string): boolean {
  return /^(price|unit price|kwd|price kwd|السعر|سعر|سعر الوحده)$/.test(norm)
}

function isIgnoredMetadataHeader(norm: string): boolean {
  if (!norm) return true
  if (norm.includes('%') || /\b(pct|percent|percentage)\b/.test(norm)) return true
  return /^(id|no|num|number|row|index|code|item code|sku code|product id|odoo id|barcode|category|cat|section|group|department|qty|quantity|units|sold|units sold|volume|orders|sales|net sales|gross sales|revenue|total|amount|delta|diff|difference|change|variance|impact|margin|cogs|cost|notes|note|comment|comments|remarks|status|branch|location|channel|ت|م|رقم|الكود|كود|رمز|القسم|الفئه|التصنيف|الكميه|عدد|المبيعات|الايراد|الاجمالي|المجموع|الفرق|التغيير|نسبه|الهامش|التكلفه|ملاحظات|ملاحظه|الحاله|الفرع|القناه)$/.test(
    norm,
  )
}

function isExplicitProposedHeader(norm: string): boolean {
  if (!norm) return false
  if (
    /^(proposed|proposed price|new|new price|target|target price|suggested|suggested price|ch|ae|kw|dine in|delivery|talabat|deliveroo|keeta|jahez|snoonu|مقترح|السعر المقترح|سعر مقترح|جديد|السعر الجديد|سعر جديد)$/.test(
      norm,
    )
  ) {
    return true
  }
  if (
    /\b(proposed|new price|option|opt|scenario|plan|tier)\b/.test(norm) ||
    /^(ch|ae)\b/.test(norm) ||
    /(مقترح|السعر الجديد|خيار|بديل|سيناريو)/.test(norm)
  ) {
    return true
  }
  return false
}

function makeOptionKey(rawLabel: string, index: number, used: Set<string>): string {
  const asciiSlug = rawLabel
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const base = asciiSlug || `option_${index + 1}`
  let candidate = base
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix += 1
  }
  used.add(candidate)
  return candidate
}

function extractSheetGridPreservingRawDecimals(sheet: XLSX.WorkSheet): string[][] {
  const ref = sheet['!ref']
  if (!ref) return []
  const range = XLSX.utils.decode_range(ref)
  const rowCount = Math.min(range.e.r - range.s.r + 1, 2_000)
  const colCount = Math.min(range.e.c - range.s.c + 1, 64)
  const grid: string[][] = []

  for (let rOffset = 0; rOffset < rowCount; rOffset += 1) {
    const r = range.s.r + rOffset
    const rowCells: string[] = []
    let hasNonEmpty = false

    for (let cOffset = 0; cOffset < colCount; cOffset += 1) {
      const c = range.s.c + cOffset
      const address = XLSX.utils.encode_cell({ r, c })
      const cell = sheet[address] as XLSX.CellObject | undefined
      let text = ''
      if (cell) {
        if (cell.t === 's') {
          text = String(cell.v ?? '').trim()
        } else if (cell.t === 'n' && typeof cell.v === 'number' && Number.isFinite(cell.v)) {
          const rawNumeric = String(cell.v)
          const formatted = typeof cell.w === 'string' ? cell.w.trim() : rawNumeric
          const rawFrac = rawNumeric.split('.')[1] ?? ''
          const fmtClean = normalizePriceInputText(formatted)
          const fmtFrac = fmtClean.split('.')[1] ?? ''
          text = rawFrac.length > fmtFrac.length ? rawNumeric : formatted
        } else if (typeof cell.w === 'string') {
          text = cell.w.trim()
        } else if (cell.v != null) {
          text = String(cell.v).trim()
        }
      }
      if (text.length > 0) hasNonEmpty = true
      rowCells.push(text)
    }

    if (hasNonEmpty) {
      grid.push(rowCells)
    }
  }

  return grid
}

function looksLikeNumericCell(raw: string): boolean {
  const cleaned = normalizePriceInputText(raw)
  if (!cleaned) return false
  return /^[+-]?\d+(?:\.\d+)?$/.test(cleaned)
}

function isSummaryFooterItemName(itemName: string): boolean {
  const norm = normalizeHeaderToken(itemName)
  return /^(total|totals|grand total|sub total|subtotal|average|avg|المجموع|الاجمالي|اجمالي|المتوسط)$/.test(
    norm,
  )
}

interface DetectedColumns {
  headerRowIndex: number
  brandCol: number | null
  itemCol: number
  currentCol: number | null
  proposedCols: Array<{ colIndex: number; optionKey: string; label: string }>
}

function detectSpreadsheetColumns(grid: readonly string[][]): DetectedColumns | null {
  const searchLimit = Math.min(grid.length, 20)
  let bestRowIdx = -1
  let bestScore = -1

  for (let r = 0; r < searchLimit; r += 1) {
    const row = grid[r] ?? []
    let hasItem = false
    let score = 0
    for (const rawCell of row) {
      const norm = normalizeHeaderToken(rawCell)
      if (!norm) continue
      if (isItemHeader(norm)) {
        hasItem = true
        score += 10
      } else if (isBrandHeader(norm)) {
        score += 3
      } else if (isCurrentPriceHeader(norm)) {
        score += 4
      } else if (isExplicitProposedHeader(norm)) {
        score += 4
      } else if (isBareGenericPriceHeader(norm)) {
        score += 2
      }
    }
    if (hasItem && score > bestScore) {
      bestScore = score
      bestRowIdx = r
    }
  }

  if (bestRowIdx < 0) {
    return null
  }

  const headerRow = grid[bestRowIdx] ?? []
  const dataRows = grid.slice(bestRowIdx + 1)

  let brandCol: number | null = null
  let itemCol = -1
  let currentCol: number | null = null
  const genericPriceCols: number[] = []
  const explicitProposedIndices: number[] = []
  const candidateOtherIndices: number[] = []

  for (let c = 0; c < headerRow.length; c += 1) {
    const rawHeader = (headerRow[c] ?? '').trim()
    if (!rawHeader) continue
    const norm = normalizeHeaderToken(rawHeader)
    if (!norm) continue

    if (itemCol < 0 && isItemHeader(norm)) {
      itemCol = c
      continue
    }
    if (brandCol === null && isBrandHeader(norm)) {
      brandCol = c
      continue
    }
    if (currentCol === null && isCurrentPriceHeader(norm)) {
      currentCol = c
      continue
    }
    if (isExplicitProposedHeader(norm)) {
      explicitProposedIndices.push(c)
      continue
    }
    if (isBareGenericPriceHeader(norm)) {
      genericPriceCols.push(c)
      continue
    }
    if (isIgnoredMetadataHeader(norm)) {
      continue
    }
    candidateOtherIndices.push(c)
  }

  if (itemCol < 0) return null

  const otherNumericCols = candidateOtherIndices.filter((colIdx) => {
    let nonEmpty = 0
    let numeric = 0
    for (const row of dataRows) {
      const val = (row[colIdx] ?? '').trim()
      if (!val) continue
      nonEmpty += 1
      if (looksLikeNumericCell(val)) numeric += 1
    }
    return nonEmpty > 0 && numeric * 2 >= nonEmpty
  })

  const finalProposedColIndices: number[] = [...explicitProposedIndices, ...otherNumericCols]

  if (genericPriceCols.length > 0) {
    if (currentCol === null && finalProposedColIndices.length > 0) {
      currentCol = genericPriceCols[0] ?? null
      for (const extraCol of genericPriceCols.slice(1)) {
        finalProposedColIndices.push(extraCol)
      }
    } else if (finalProposedColIndices.length === 0) {
      for (const priceCol of genericPriceCols) {
        finalProposedColIndices.push(priceCol)
      }
    }
  }

  finalProposedColIndices.sort((a, b) => a - b)

  const usedKeys = new Set<string>()
  const proposedCols = finalProposedColIndices.map((colIndex, idx) => {
    const label = (headerRow[colIndex] ?? '').trim() || `Option ${idx + 1}`
    return {
      colIndex,
      optionKey: makeOptionKey(label, idx, usedKeys),
      label,
    }
  })

  return {
    headerRowIndex: bestRowIdx,
    brandCol,
    itemCol,
    currentCol,
    proposedCols,
  }
}

export function parseSpreadsheetIntakeRows(bytes: Uint8Array): RawExtractedIntakeRow[] {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(Buffer.from(bytes), {
      type: 'buffer',
      raw: false,
      codepage: 65001,
    })
  } catch {
    throw new DocumentIntakeError(
      'INVALID_SPREADSHEET',
      'Unable to parse uploaded spreadsheet.',
      400,
    )
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new DocumentIntakeError('EMPTY_SPREADSHEET', 'Uploaded workbook contains no sheets.', 400)
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const grid = extractSheetGridPreservingRawDecimals(sheet)
    if (grid.length < 2) continue

    const cols = detectSpreadsheetColumns(grid)
    if (!cols) continue

    const extracted: RawExtractedIntakeRow[] = []
    const dataRows = grid.slice(cols.headerRowIndex + 1)

    for (const row of dataRows) {
      const itemName = (row[cols.itemCol] ?? '').replace(/\s+/g, ' ').trim()
      if (!itemName || isSummaryFooterItemName(itemName)) continue

      const rawBrand = cols.brandCol !== null ? (row[cols.brandCol] ?? '').trim() : ''
      const rawCurrent = cols.currentCol !== null ? (row[cols.currentCol] ?? '').trim() : ''

      const proposedOptions: ExtractedProposedOption[] = cols.proposedCols.map((col) => ({
        optionKey: col.optionKey,
        label: col.label,
        proposedPriceKwd: (row[col.colIndex] ?? '').trim(),
      }))

      extracted.push({
        brand: rawBrand || null,
        itemName,
        sheetCurrentPriceKwd: rawCurrent || null,
        proposedOptions,
      })
    }

    if (extracted.length > 0) {
      return extracted
    }
  }

  throw new DocumentIntakeError(
    'EMPTY_SPREADSHEET',
    'No valid menu pricing rows with an item header were found in the uploaded file.',
    422,
  )
}

export const visionExtractedOptionSchema = z.object({
  option_key: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1),
  proposed_price: z.union([z.string(), z.number()]),
})

export const visionExtractedRowSchema = z.object({
  brand: z.string().trim().nullable().optional(),
  item_name: z.string().trim().min(1),
  current_price: z.union([z.string(), z.number()]).nullable().optional(),
  proposed_options: z.array(visionExtractedOptionSchema),
})

export const visionExtractionPayloadSchema = z.object({
  rows: z.array(visionExtractedRowSchema),
})

export type VisionExtractionPayload = z.infer<typeof visionExtractionPayloadSchema>

const VISION_SYSTEM_PROMPT = [
  'You extract structured restaurant menu pricing rows from an uploaded table image in Kuwait (KWD).',
  'Return STRICT JSON ONLY matching this exact schema:',
  '{"rows":[{"brand":string|null,"item_name":string,"current_price":string|null,"proposed_options":[{"option_key":string,"label":string,"proposed_price":string}]}]}',
  'Rules:',
  '- Copy every digit EXACTLY as printed in the image (preserve trailing zeros and exact decimals, e.g. "1.500", "0.400").',
  '- Never invent items or calculate numbers.',
  '- If multiple proposed columns exist (e.g. CH, AE, Option A, Option B), include each in proposed_options in column order.',
  '- If only one proposed price column exists, set label to its header (or "Proposed") and option_key to "proposed".',
].join('\n')

const VISION_USER_PROMPT =
  'Extract all menu item pricing rows from this image as strict JSON with exact string prices.'

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced && fenced[1]) return fenced[1].trim()
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }
  return trimmed
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function extractGeminiText(payload: unknown): string | null {
  const body = asRecord(payload)
  if (!body) return null
  const candidates = Array.isArray(body.candidates) ? body.candidates : []
  const first = asRecord(candidates[0])
  const content = asRecord(first?.content)
  const parts = Array.isArray(content?.parts) ? content.parts : []
  const text = parts
    .map((part) => {
      const rec = asRecord(part)
      return rec && typeof rec.text === 'string' ? rec.text : ''
    })
    .join('')
    .trim()
  return text || null
}

function extractAnthropicText(payload: unknown): string | null {
  const body = asRecord(payload)
  if (!body) return null
  const content = Array.isArray(body.content) ? body.content : []
  const text = content
    .map((part) => {
      const rec = asRecord(part)
      return rec && rec.type === 'text' && typeof rec.text === 'string' ? rec.text : ''
    })
    .join('')
    .trim()
  return text || null
}

async function callGeminiVision(input: {
  apiKey: string
  model: string
  base64Data: string
  mimeType: string
  timeoutMs: number
  fetchImpl: typeof fetch
}): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:generateContent`
    const response = await input.fetchImpl(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': input.apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: input.mimeType, data: input.base64Data } },
              { text: VISION_USER_PROMPT },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
        },
      }),
    })
    if (!response.ok) return null
    const json: unknown = await response.json().catch(() => null)
    return extractGeminiText(json)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function callAnthropicVision(input: {
  apiKey: string
  model: string
  base64Data: string
  mimeType: string
  timeoutMs: number
  fetchImpl: typeof fetch
}): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs)
  try {
    const response = await input.fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': input.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 2048,
        system: VISION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: input.mimeType,
                  data: input.base64Data,
                },
              },
              { type: 'text', text: VISION_USER_PROMPT },
            ],
          },
        ],
      }),
    })
    if (!response.ok) return null
    const json: unknown = await response.json().catch(() => null)
    return extractAnthropicText(json)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function normalizeVisionPayloadToRows(payload: VisionExtractionPayload): RawExtractedIntakeRow[] {
  const canonicalKeyByLabel = new Map<string, string>()
  const usedKeys = new Set<string>()

  return payload.rows
    .filter((row) => row.item_name.trim().length > 0 && !isSummaryFooterItemName(row.item_name))
    .map((row) => {
      const rawCurrent =
        row.current_price == null ? '' : String(row.current_price).trim()
      const rowUsedKeys = new Set<string>()

      const proposedOptions: ExtractedProposedOption[] = row.proposed_options.map((opt, idx) => {
        const label = opt.label.trim() || `Option ${idx + 1}`
        const labelNorm = label.toLowerCase()
        let key = canonicalKeyByLabel.get(labelNorm)
        if (!key) {
          const rawOptionKey = opt.option_key ? opt.option_key.trim() : label
          key = makeOptionKey(rawOptionKey, idx, usedKeys)
          canonicalKeyByLabel.set(labelNorm, key)
        }
        if (rowUsedKeys.has(key)) {
          key = makeOptionKey(label, idx, rowUsedKeys)
        } else {
          rowUsedKeys.add(key)
        }
        return {
          optionKey: key,
          label,
          proposedPriceKwd: String(opt.proposed_price).trim(),
        }
      })

      return {
        brand: row.brand && row.brand.trim() ? row.brand.trim() : null,
        itemName: row.item_name.trim(),
        sheetCurrentPriceKwd: rawCurrent || null,
        proposedOptions,
      }
    })
}

export interface VisionExtractOptions {
  fetchImpl?: typeof fetch
  keys?: CouncilKeys
  models?: CouncilModels
  timeoutMs?: number
  visionExtractOverride?: (input: {
    bytes: Uint8Array
    mimeType: string
    fileName: string
  }) => Promise<unknown>
}

export async function extractVisionIntakeRows(
  input: {
    bytes: Uint8Array
    mimeType: string
    fileName: string
  },
  options: VisionExtractOptions = {},
): Promise<RawExtractedIntakeRow[]> {
  if (options.visionExtractOverride) {
    const rawOverride = await options.visionExtractOverride(input)
    const parsedOverride = visionExtractionPayloadSchema.safeParse(rawOverride)
    if (!parsedOverride.success) {
      throw new DocumentIntakeError(
        'VISION_INVALID_SCHEMA',
        'Vision extraction output failed schema validation.',
        422,
      )
    }
    return normalizeVisionPayloadToRows(parsedOverride.data)
  }

  const keys = options.keys ?? readCouncilKeys()
  const models = options.models ?? resolveCouncilModels()
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? VISION_EXTRACTION_TIMEOUT_MS

  const hasGoogle = keys.google.trim().length >= MIN_PROVIDER_KEY_LENGTH
  const hasAnthropic = keys.anthropic.trim().length >= MIN_PROVIDER_KEY_LENGTH

  if (!hasGoogle && !hasAnthropic) {
    throw new DocumentIntakeError(
      'VISION_PROVIDER_UNAVAILABLE',
      'No vision AI provider key is configured on the server.',
      503,
    )
  }

  const base64Data = Buffer.from(input.bytes).toString('base64')
  let rawJsonText: string | null = null

  if (hasGoogle) {
    rawJsonText = await callGeminiVision({
      apiKey: keys.google.trim(),
      model: models.google,
      base64Data,
      mimeType: input.mimeType,
      timeoutMs,
      fetchImpl,
    })
  }

  if (!rawJsonText && hasAnthropic) {
    rawJsonText = await callAnthropicVision({
      apiKey: keys.anthropic.trim(),
      model: models.anthropic,
      base64Data,
      mimeType: input.mimeType,
      timeoutMs,
      fetchImpl,
    })
  }

  if (!rawJsonText) {
    throw new DocumentIntakeError(
      'VISION_PROVIDER_ERROR',
      'Vision provider failed to extract pricing table from the image.',
      502,
    )
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(stripCodeFences(rawJsonText))
  } catch {
    throw new DocumentIntakeError(
      'VISION_INVALID_SCHEMA',
      'Vision provider did not return valid JSON.',
      422,
    )
  }

  const validated = visionExtractionPayloadSchema.safeParse(decoded)
  if (!validated.success) {
    throw new DocumentIntakeError(
      'VISION_INVALID_SCHEMA',
      'Vision provider JSON did not match required pricing schema.',
      422,
    )
  }

  return normalizeVisionPayloadToRows(validated.data)
}

function stripOdooCodePrefix(name: string): string {
  return name.replace(/^\s*\[[^\]]+\]\s*/, '').trim()
}

export interface MatchIntakeItemOptions {
  rowBrand?: string | null
  contextBrand?: string | null
  sheetCurrentPriceKwd?: string | null
}

export interface IntakeMatchEvaluation {
  matchedRow: ItemPricingRow | null
  rejectedVariantHint: RejectedVariantHint | null
}

export function matchIntakeItemWithDiagnostics(
  itemName: string,
  odooRows: readonly ItemPricingRow[],
  options?: MatchIntakeItemOptions,
): IntakeMatchEvaluation {
  const contextBrandId =
    resolveIntakeBrandId(options?.contextBrand) ?? resolveCanonicalBrandId(options?.contextBrand)
  const explicitRowBrandId =
    resolveIntakeBrandId(options?.rowBrand) ??
    resolveCanonicalBrandId(options?.rowBrand) ??
    inferBrandIdFromSkuName(itemName)

  if (contextBrandId && explicitRowBrandId && explicitRowBrandId !== contextBrandId) {
    return { matchedRow: null, rejectedVariantHint: null }
  }

  const effectiveRowBrandId = explicitRowBrandId ?? contextBrandId

  const safeRows = odooRows.filter((row) => {
    if (!row.name || isExcludedOdooEntity(row.name)) return false
    if (
      !areSkuBrandsCompatible({
        rowBrand: explicitRowBrandId ?? options?.rowBrand,
        sheetItemName: itemName,
        candidateBrand: row.brandId,
        candidateSkuName: row.name,
        contextBrand: contextBrandId,
      })
    ) {
      return false
    }
    if (!hasCompatibleSizePackTokens(itemName, row.name)) {
      return false
    }
    return true
  })
  if (safeRows.length === 0) {
    return { matchedRow: null, rejectedVariantHint: null }
  }

  const wantedKey = normalizeIntakeSkuKey(stripOdooCodePrefix(itemName))
  if (!wantedKey) {
    return { matchedRow: null, rejectedVariantHint: null }
  }

  let candidate: ItemPricingRow | null = null

  const exactMatches = safeRows.filter((row) => {
    const fullKey = normalizeIntakeSkuKey(row.name)
    const strippedKey = normalizeIntakeSkuKey(stripOdooCodePrefix(row.name))
    return fullKey === wantedKey || strippedKey === wantedKey
  })

  if (exactMatches.length === 1) {
    candidate = exactMatches[0] ?? null
  } else if (exactMatches.length > 1) {
    if (hasCrossBrandAmbiguity(exactMatches, effectiveRowBrandId)) {
      return { matchedRow: null, rejectedVariantHint: null }
    }
    const sanityPassing = options?.sheetCurrentPriceKwd
      ? exactMatches.filter(
          (row) =>
            !checkPriceSanityDeviation(
              options.sheetCurrentPriceKwd,
              formatOdooUnitPriceOrNull(row),
            ).exceedsThreshold,
        )
      : exactMatches
    const pool = sanityPassing.length > 0 ? sanityPassing : exactMatches
    candidate =
      pool.slice().sort((a, b) => {
        const left = Decimal.parse(b.netKwd)
        const right = Decimal.parse(a.netKwd)
        if (!left || !right) return a.productId - b.productId
        const cmp = left.compare(right)
        return cmp !== 0 ? cmp : a.productId - b.productId
      })[0] ?? null
  }

  if (!candidate) {
    candidate = matchProposedPrice({ label: itemName, amount: '1' }, safeRows, {
      rowBrand: explicitRowBrandId ?? options?.rowBrand,
      contextBrand: contextBrandId,
    })
  }

  if (!candidate && wantedKey.length >= 3) {
    const normalizedSubstringHits = safeRows.filter((row) => {
      const candidateKey = normalizeIntakeSkuKey(stripOdooCodePrefix(row.name))
      return (
        candidateKey.length >= 3 &&
        (candidateKey.includes(wantedKey) || wantedKey.includes(candidateKey))
      )
    })
    if (
      normalizedSubstringHits.length === 1 &&
      !hasCrossBrandAmbiguity(normalizedSubstringHits, effectiveRowBrandId)
    ) {
      candidate = normalizedSubstringHits[0] ?? null
    }
  }

  if (!candidate) {
    return { matchedRow: null, rejectedVariantHint: null }
  }

  const candidateUnitPrice = formatOdooUnitPriceOrNull(candidate)
  const sanity = checkPriceSanityDeviation(options?.sheetCurrentPriceKwd, candidateUnitPrice)
  if (sanity.exceedsThreshold && candidateUnitPrice) {
    return {
      matchedRow: null,
      rejectedVariantHint: {
        odooName: candidate.name,
        odooUnitPriceKwd: candidateUnitPrice,
        diffPct: sanity.diffPct ?? '35',
      },
    }
  }

  return { matchedRow: candidate, rejectedVariantHint: null }
}

export function matchIntakeItemToOdooRow(
  itemName: string,
  odooRows: readonly ItemPricingRow[],
  options?: MatchIntakeItemOptions,
): ItemPricingRow | null {
  return matchIntakeItemWithDiagnostics(itemName, odooRows, options).matchedRow
}

function formatOdooUnitPriceOrNull(row: ItemPricingRow): string | null {
  const rawUnit = row.unitPriceKwd ?? unitPriceKwd(row.netKwd, row.qty)
  if (!rawUnit) return null
  const parsed = Decimal.parse(rawUnit)
  if (!parsed || parsed.sign() <= 0) return null
  return formatKwd3(parsed)
}

function formatOdooNetKwd(rawNet: string): string {
  const parsed = Decimal.parse(rawNet)
  return parsed ? formatKwd3(parsed) : rawNet
}

export function resolveIntakeBrandId(rawBrand: string | null | undefined): ApprovedFeryalBrandId | null {
  if (!rawBrand) return null
  const trimmed = rawBrand.trim()
  if (!trimmed || trimmed.toLowerCase() === 'all' || isExcludedOdooEntity(trimmed)) return null

  const validated = validateFeryalContextDefaults({ brand: trimmed })
  if (validated.brandId) return validated.brandId

  const norm = normalizeArabicText(trimmed)
  for (const meta of APPROVED_FERYAL_BRAND_LIST) {
    if (
      normalizeArabicText(meta.nameEn) === norm ||
      normalizeArabicText(meta.nameAr) === norm ||
      meta.aliases.some((alias) => normalizeArabicText(alias) === norm)
    ) {
      return meta.id
    }
  }
  return null
}

export function resolveIntakeBranchId(
  rawBranch: string | null | undefined,
): ApprovedFeryalBranchId | null {
  if (!rawBranch) return null
  const trimmed = rawBranch.trim()
  if (!trimmed || trimmed.toLowerCase() === 'all' || isExcludedOdooEntity(trimmed)) return null

  const validated = validateFeryalContextDefaults({ branch: trimmed })
  if (validated.branchId) return validated.branchId

  const norm = normalizeArabicText(trimmed)
  for (const meta of ALL_FERYAL_BRANCHES) {
    if (
      normalizeArabicText(meta.nameEn) === norm ||
      normalizeArabicText(meta.nameAr) === norm ||
      meta.aliases.some((alias) => normalizeArabicText(alias) === norm)
    ) {
      return meta.id
    }
  }
  return null
}

export function buildDocumentIntakeDraftFromExtractedRows(input: {
  draftId?: string
  fileName: string
  fileKind: DocumentIntakeFileKind
  period: { from: string; to: string }
  brand: string | null
  branch: string | null
  extractedRows: readonly RawExtractedIntakeRow[]
  odooRows: readonly ItemPricingRow[]
}): DocumentIntakeDraft {
  const draftId = input.draftId ?? `draft_${randomUUID()}`
  const draftBrandId = resolveIntakeBrandId(input.brand)

  const initialRows: DocumentIntakeRow[] = input.extractedRows.map((extracted, idx) => {
    const rowBrandId = resolveIntakeBrandId(extracted.brand) ?? draftBrandId
    const evaluation = matchIntakeItemWithDiagnostics(extracted.itemName, input.odooRows, {
      rowBrand: extracted.brand ?? rowBrandId,
      contextBrand: draftBrandId,
      sheetCurrentPriceKwd: extracted.sheetCurrentPriceKwd,
    })
    const matched = evaluation.matchedRow
    return {
      rowId: `row_${idx + 1}`,
      brand: extracted.brand ?? input.brand,
      itemName: extracted.itemName,
      sheetCurrentPriceKwd: extracted.sheetCurrentPriceKwd,
      proposedOptions: extracted.proposedOptions,
      matchedOdooProductId: matched ? matched.productId : null,
      matchedOdooProductName: matched ? matched.name : null,
      odooRealizedUnitPriceKwd: matched ? formatOdooUnitPriceOrNull(matched) : null,
      odooQty: matched ? matched.qty : null,
      odooNetSalesKwd: matched ? formatOdooNetKwd(matched.netKwd) : null,
      rejectedVariantHint: evaluation.rejectedVariantHint,
      excluded: false,
      anomalies: [],
    }
  })

  const rows = recomputeIntakeRowAnomalies(initialRows)
  const summary = summarizeDocumentIntakeRows(rows)

  return {
    draftId,
    fileName: input.fileName,
    fileKind: input.fileKind,
    sourceTag: EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
    requiresHumanConfirmation: true,
    period: input.period,
    brand: input.brand,
    branch: input.branch,
    rows,
    summary,
  }
}

export interface IngestPricingDocumentInput {
  fileName: string
  mimeType?: string | null
  bytes: Uint8Array
  period?: string | null
  customFrom?: string | null
  customTo?: string | null
  brand?: string | null
  branch?: string | null
}

export interface IngestPricingDocumentOptions extends VisionExtractOptions {
  draftId?: string
  referenceNowMs?: number
  odooRowsOverride?: readonly ItemPricingRow[]
  fetchOdooPricing?: typeof fetchItemPricingFromOdoo
}

export async function ingestPricingDocument(
  input: IngestPricingDocumentInput,
  options: IngestPricingDocumentOptions = {},
): Promise<DocumentIntakeDraft> {
  if (input.bytes.byteLength === 0) {
    throw new DocumentIntakeError('EMPTY_FILE', 'Uploaded file is empty.', 400)
  }
  if (input.bytes.byteLength > MAX_DOCUMENT_INTAKE_BYTES) {
    throw new DocumentIntakeError(
      'FILE_TOO_LARGE',
      'Uploaded file exceeds the 10 MB limit.',
      413,
    )
  }

  const detected = detectIntakeFileKind(input.fileName, input.mimeType)
  if (!detected) {
    throw new DocumentIntakeError(
      'UNSUPPORTED_FILE_TYPE',
      'Unsupported file format. Allowed formats: .xlsx, .csv, .jpg, .jpeg, .png, .webp.',
      415,
    )
  }

  const validatedDefaults = validateFeryalContextDefaults({
    period: input.period ?? null,
    customFrom: input.customFrom ?? null,
    customTo: input.customTo ?? null,
    brand: input.brand ?? null,
    branch: input.branch ?? null,
  })

  const brandId = validatedDefaults.brandId ?? resolveIntakeBrandId(input.brand)
  const branchId = validatedDefaults.branchId ?? resolveIntakeBranchId(input.branch)

  const resolvedPeriod = resolveFeryalQuestionPeriod(
    '',
    options.referenceNowMs ?? Date.now(),
    {
      period: validatedDefaults.period,
      customFrom: validatedDefaults.customFrom,
      customTo: validatedDefaults.customTo,
    },
  )

  const extractedRows =
    detected.fileKind === 'image'
      ? await extractVisionIntakeRows(
          {
            bytes: input.bytes,
            mimeType: detected.normalizedMime,
            fileName: input.fileName,
          },
          options,
        )
      : parseSpreadsheetIntakeRows(input.bytes)

  let odooRows: readonly ItemPricingRow[] = []
  if (options.odooRowsOverride) {
    odooRows = options.odooRowsOverride
  } else {
    const fetchPricing = options.fetchOdooPricing ?? fetchItemPricingFromOdoo
    try {
      const read = await fetchPricing({
        fromIso: resolvedPeriod.from,
        toIso: resolvedPeriod.to,
        branchLocation: branchId,
        posRoot: posRootForBrand(brandId),
      })
      odooRows = read ? read.rows : []
    } catch {
      logger.warn('feryal.document_intake', { code: 'odoo_pricing_fallback_empty' })
      odooRows = []
    }
  }

  return buildDocumentIntakeDraftFromExtractedRows({
    draftId: options.draftId,
    fileName: input.fileName,
    fileKind: detected.fileKind,
    period: { from: resolvedPeriod.from, to: resolvedPeriod.to },
    brand: brandId,
    branch: branchId,
    extractedRows,
    odooRows,
  })
}
