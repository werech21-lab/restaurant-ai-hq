import 'server-only'

import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
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
  inferConfirmedSheetBrandId,
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
  enforceOneToOneSkuMatches,
  hasCompatibleFlavorProteinTokens,
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
const VISION_MAX_OUTPUT_TOKENS = 8_192
const MIN_PROVIDER_KEY_LENGTH = 20

export type ExifOrientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type IntakeRotationDegrees = 0 | 90 | 180 | 270

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

function isExifOrientationValue(val: number): val is ExifOrientation {
  return Number.isInteger(val) && val >= 1 && val <= 8
}

function readTiffExifOrientation(
  bytes: Uint8Array,
  tiffStart: number,
  tiffEnd: number,
): ExifOrientation | null {
  if (tiffStart < 0 || tiffEnd > bytes.length || tiffStart + 8 > tiffEnd) {
    return null
  }

  const b0 = bytes[tiffStart]
  const b1 = bytes[tiffStart + 1]
  let littleEndian: boolean
  if (b0 === 0x49 && b1 === 0x49) {
    littleEndian = true
  } else if (b0 === 0x4d && b1 === 0x4d) {
    littleEndian = false
  } else {
    return null
  }

  const readU16 = (pos: number): number | null => {
    if (pos < tiffStart || pos + 2 > tiffEnd) return null
    const low = bytes[pos]!
    const high = bytes[pos + 1]!
    return littleEndian ? low | (high << 8) : (low << 8) | high
  }

  const readU32 = (pos: number): number | null => {
    if (pos < tiffStart || pos + 4 > tiffEnd) return null
    const a = bytes[pos]!
    const b = bytes[pos + 1]!
    const c = bytes[pos + 2]!
    const d = bytes[pos + 3]!
    if (littleEndian) {
      return (a | (b << 8) | (c << 16) | (d << 24)) >>> 0
    }
    return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
  }

  const magic = readU16(tiffStart + 2)
  if (magic !== 0x002a) return null

  const ifdOffset = readU32(tiffStart + 4)
  if (ifdOffset === null) return null

  const ifdStart = tiffStart + ifdOffset
  const entryCount = readU16(ifdStart)
  if (entryCount === null || entryCount <= 0 || entryCount > 512) return null

  for (let i = 0; i < entryCount; i += 1) {
    const entryOffset = ifdStart + 2 + i * 12
    if (entryOffset + 12 > tiffEnd) break
    const tag = readU16(entryOffset)
    if (tag === 0x0112) {
      const value = readU16(entryOffset + 8)
      if (value !== null && isExifOrientationValue(value)) {
        return value
      }
      return null
    }
  }

  return null
}

/**
 * Pure TypeScript JPEG / TIFF / PNG (`eXIf`) / WebP (`EXIF`) orientation detector.
 * Returns EXIF orientation tag `1..8` (defaults to `1` when upright or absent).
 */
export function detectExifOrientation(bytes: Uint8Array): ExifOrientation {
  if (!bytes || bytes.length < 8) return 1

  // 1. Raw TIFF stream ("II*\0" or "MM\0*")
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a)
  ) {
    return readTiffExifOrientation(bytes, 0, bytes.length) ?? 1
  }

  // 2. JPEG APP1 Exif segment
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) break
      while (offset < bytes.length && bytes[offset] === 0xff) {
        offset += 1
      }
      if (offset >= bytes.length) break
      const marker = bytes[offset]!
      offset += 1

      if (marker === 0xd9 || marker === 0xda) break
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
      if (offset + 2 > bytes.length) break

      const segLength = (bytes[offset]! << 8) | bytes[offset + 1]!
      if (segLength < 2 || offset + segLength > bytes.length) break

      if (
        marker === 0xe1 &&
        segLength >= 10 &&
        bytes[offset + 2] === 0x45 &&
        bytes[offset + 3] === 0x78 &&
        bytes[offset + 4] === 0x69 &&
        bytes[offset + 5] === 0x66 &&
        bytes[offset + 6] === 0x00 &&
        bytes[offset + 7] === 0x00
      ) {
        const parsed = readTiffExifOrientation(bytes, offset + 8, offset + segLength)
        if (parsed !== null) return parsed
      }

      offset += segLength
    }
    return 1
  }

  // 3. PNG eXIf chunk
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    let offset = 8
    while (offset + 12 <= bytes.length) {
      const chunkLen =
        ((bytes[offset]! << 24) |
          (bytes[offset + 1]! << 16) |
          (bytes[offset + 2]! << 8) |
          bytes[offset + 3]!) >>>
        0
      const type0 = bytes[offset + 4]
      const type1 = bytes[offset + 5]
      const type2 = bytes[offset + 6]
      const type3 = bytes[offset + 7]
      const dataStart = offset + 8
      const dataEnd = dataStart + chunkLen
      if (dataEnd + 4 > bytes.length) break
      // 'eXIf' = 0x65 0x58 0x49 0x66
      if (type0 === 0x65 && type1 === 0x58 && type2 === 0x49 && type3 === 0x66) {
        const hasExifHeader =
          chunkLen >= 6 &&
          bytes[dataStart] === 0x45 &&
          bytes[dataStart + 1] === 0x78 &&
          bytes[dataStart + 2] === 0x69 &&
          bytes[dataStart + 3] === 0x66
        const tiffOffset = hasExifHeader ? dataStart + 6 : dataStart
        const parsed = readTiffExifOrientation(bytes, tiffOffset, dataEnd)
        if (parsed !== null) return parsed
      }
      offset = dataEnd + 4
    }
    return 1
  }

  // 4. WebP RIFF EXIF chunk
  if (
    bytes.length >= 20 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    let offset = 12
    while (offset + 8 <= bytes.length) {
      const c0 = bytes[offset]
      const c1 = bytes[offset + 1]
      const c2 = bytes[offset + 2]
      const c3 = bytes[offset + 3]
      const chunkSize =
        (bytes[offset + 4]! |
          (bytes[offset + 5]! << 8) |
          (bytes[offset + 6]! << 16) |
          (bytes[offset + 7]! << 24)) >>>
        0
      const dataStart = offset + 8
      const dataEnd = dataStart + chunkSize
      if (dataEnd > bytes.length) break
      // 'EXIF' = 0x45 0x58 0x49 0x46
      if (c0 === 0x45 && c1 === 0x58 && c2 === 0x49 && c3 === 0x46) {
        const hasExifPrefix =
          chunkSize >= 6 &&
          bytes[dataStart] === 0x45 &&
          bytes[dataStart + 1] === 0x78 &&
          bytes[dataStart + 2] === 0x69 &&
          bytes[dataStart + 3] === 0x66 &&
          bytes[dataStart + 4] === 0x00 &&
          bytes[dataStart + 5] === 0x00
        const tiffStart = hasExifPrefix ? dataStart + 6 : dataStart
        const parsed = readTiffExifOrientation(bytes, tiffStart, dataEnd)
        if (parsed !== null) return parsed
      }
      offset = dataEnd + (chunkSize % 2)
    }
  }

  return 1
}

export function exifOrientationToClockwiseDegrees(
  orientation: ExifOrientation,
): IntakeRotationDegrees {
  if (orientation === 3 || orientation === 4) return 180
  if (orientation === 6 || orientation === 7) return 90
  if (orientation === 8 || orientation === 5) return 270
  return 0
}

export function parseIntakeRotationDegrees(raw: unknown): IntakeRotationDegrees {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const norm = ((Math.round(raw) % 360) + 360) % 360
    if (norm === 90 || norm === 180 || norm === 270) return norm
    return 0
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    const parsed = Number(raw.trim())
    if (Number.isFinite(parsed)) {
      const norm = ((Math.round(parsed) % 360) + 360) % 360
      if (norm === 90 || norm === 180 || norm === 270) return norm
    }
  }
  return 0
}

interface SharpLikePipeline {
  rotate(angle?: number): SharpLikePipeline
  jpeg(options?: { quality?: number }): SharpLikePipeline
  png(options?: { compressionLevel?: number }): SharpLikePipeline
  webp(options?: { quality?: number }): SharpLikePipeline
  toBuffer(): Promise<Buffer>
}

type SharpLikeFactory = (input: Buffer) => SharpLikePipeline

function loadOptionalSharp(): SharpLikeFactory | null {
  try {
    const dynamicRequire = (0, eval)('require') as (moduleId: string) => unknown
    const mod = dynamicRequire('sharp')
    if (typeof mod === 'function') return mod as SharpLikeFactory
  } catch {
    // Fall through to createRequire for pure ESM runtimes
  }
  try {
    const esmRequire = createRequire(path.join(process.cwd(), 'package.json'))
    const mod: unknown = esmRequire('sharp')
    if (typeof mod === 'function') return mod as SharpLikeFactory
  } catch {
    // Safe fallback when sharp binary is absent
  }
  return null
}

export interface NormalizedImageOrientationResult {
  bytes: Uint8Array
  mimeType: string
  exifOrientation: ExifOrientation
  appliedDegrees: IntakeRotationDegrees
  normalizedBySharp: boolean
}

/**
 * Normalizes image EXIF orientation (`3`=180°, `6`=90° CW, `8`=270° CW) plus optional explicit
 * clockwise rotation (`0 | 90 | 180 | 270`) using Next runtime `sharp` when available, with a
 * zero-crash fallback when `sharp` is absent or synthetic test buffers are supplied.
 */
export async function normalizeIntakeImageOrientation(
  bytes: Uint8Array,
  mimeType: string,
  extraRotationDegrees?: IntakeRotationDegrees | null,
): Promise<NormalizedImageOrientationResult> {
  const exifOrientation = detectExifOrientation(bytes)
  const exifDegrees = exifOrientationToClockwiseDegrees(exifOrientation)
  const extraDegrees = extraRotationDegrees ?? 0
  const combinedDegrees = (((exifDegrees + extraDegrees) % 360) as IntakeRotationDegrees)

  if (exifOrientation === 1 && extraDegrees === 0) {
    return {
      bytes,
      mimeType,
      exifOrientation,
      appliedDegrees: 0,
      normalizedBySharp: false,
    }
  }

  const sharpFn = loadOptionalSharp()
  if (!sharpFn) {
    return {
      bytes,
      mimeType,
      exifOrientation,
      appliedDegrees: combinedDegrees,
      normalizedBySharp: false,
    }
  }

  try {
    let pipeline = sharpFn(Buffer.from(bytes)).rotate()
    if (extraDegrees !== 0) {
      pipeline = pipeline.rotate(extraDegrees)
    }

    let outMime = mimeType
    if (mimeType === 'image/png') {
      pipeline = pipeline.png({ compressionLevel: 6 })
    } else if (mimeType === 'image/webp') {
      pipeline = pipeline.webp({ quality: 92 })
    } else {
      pipeline = pipeline.jpeg({ quality: 92 })
      outMime = 'image/jpeg'
    }

    const rotatedBuffer = await pipeline.toBuffer()
    if (rotatedBuffer.byteLength > 0) {
      return {
        bytes: new Uint8Array(
          rotatedBuffer.buffer,
          rotatedBuffer.byteOffset,
          rotatedBuffer.byteLength,
        ),
        mimeType: outMime,
        exifOrientation,
        appliedDegrees: combinedDegrees,
        normalizedBySharp: true,
      }
    }
  } catch {
    // Graceful fallback for synthetic test byte stubs or unsupported image streams
  }

  return {
    bytes,
    mimeType,
    exifOrientation,
    appliedDegrees: combinedDegrees,
    normalizedBySharp: false,
  }
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
    ) ||
    /\b(current price|old price|actual price)\b/.test(norm) ||
    /(السعر الحالي|سعر حالي|السعر الفعلي)/.test(norm)
  )
}

function isBareGenericPriceHeader(norm: string): boolean {
  return /^(price|unit price|kwd|price kwd|السعر|سعر|سعر الوحده)$/.test(norm)
}

function isDeltaOrIncreaseLabel(norm: string): boolean {
  if (!norm) return false
  if (norm.includes('%') || /\b(pct|percent|percentage)\b/.test(norm)) return true
  if (
    /\b(proposed|suggested|new price|target|option|opt|scenario|مقترح|جديد|خيار|بديل)\b/.test(
      norm,
    )
  ) {
    return false
  }
  return /^(increase|increases|inc|price increase|kwd increase|amount increase|decrease|uplift|hike|markup|adjustment|delta|diff|difference|change|price change|variance|impact|الزياده|زياده|مقدار الزياده|قيمه الزياده|الفرق|فرق السعر|التغيير|التغير)$/.test(
    norm,
  )
}

function isIgnoredMetadataHeader(norm: string): boolean {
  if (!norm) return true
  if (isDeltaOrIncreaseLabel(norm)) return true
  return /^(id|no|num|number|row|index|code|item code|sku code|product id|odoo id|barcode|category|cat|section|group|department|qty|quantity|units|sold|units sold|volume|orders|sales|net sales|gross sales|revenue|total|amount|margin|cogs|cost|notes|note|comment|comments|remarks|status|branch|location|channel|ت|م|رقم|الكود|كود|رمز|القسم|الفئه|التصنيف|الكميه|عدد|المبيعات|الايراد|الاجمالي|المجموع|نسبه|الهامش|التكلفه|ملاحظات|ملاحظه|الحاله|الفرع|القناه)$/.test(
    norm,
  )
}

function isExplicitProposedHeader(norm: string): boolean {
  if (!norm) return false
  if (
    /^(proposed|proposed price|new|new price|target|target price|suggested|suggested price|ch|ch suggested|suggested ch|ae|ae suggested|suggested ae|kw|kw suggested|dine in|delivery|talabat|deliveroo|keeta|jahez|snoonu|مقترح|السعر المقترح|سعر مقترح|جديد|السعر الجديد|سعر جديد)$/.test(
      norm,
    )
  ) {
    return true
  }
  if (
    /\b(proposed|suggested|new price|option|opt|scenario|plan|tier)\b/.test(norm) ||
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

interface DetectedColumnBlock {
  brandCol: number | null
  itemCol: number
  currentCol: number | null
  proposedCols: Array<{ colIndex: number; optionKey: string; label: string }>
}

interface DetectedSpreadsheetLayout {
  headerRowIndex: number
  blocks: DetectedColumnBlock[]
}

function detectColumnBlockInSlice(
  headerRow: readonly string[],
  dataRows: readonly string[][],
  startCol: number,
  endColExclusive: number,
  canonicalKeysByLabel: Map<string, string>,
  globalUsedKeys: Set<string>,
): DetectedColumnBlock | null {
  let brandCol: number | null = null
  let itemCol = -1
  let currentCol: number | null = null
  const genericPriceCols: number[] = []
  const explicitProposedIndices: number[] = []
  const candidateOtherIndices: number[] = []

  for (let c = startCol; c < endColExclusive; c += 1) {
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

  const blockUsedKeys = new Set<string>()
  const proposedCols = finalProposedColIndices.map((colIndex, idx) => {
    const label = (headerRow[colIndex] ?? '').trim() || `Option ${idx + 1}`
    const normLabel = label.toLowerCase()
    let optionKey = canonicalKeysByLabel.get(normLabel)
    if (!optionKey) {
      optionKey = makeOptionKey(label, idx, globalUsedKeys)
      canonicalKeysByLabel.set(normLabel, optionKey)
    }
    if (blockUsedKeys.has(optionKey)) {
      optionKey = makeOptionKey(label, idx, blockUsedKeys)
    } else {
      blockUsedKeys.add(optionKey)
    }
    return {
      colIndex,
      optionKey,
      label,
    }
  })

  return {
    brandCol,
    itemCol,
    currentCol,
    proposedCols,
  }
}

function detectSpreadsheetLayout(grid: readonly string[][]): DetectedSpreadsheetLayout | null {
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

  const itemIndices: number[] = []
  for (let c = 0; c < headerRow.length; c += 1) {
    const norm = normalizeHeaderToken((headerRow[c] ?? '').trim())
    if (norm && isItemHeader(norm)) {
      itemIndices.push(c)
    }
  }
  if (itemIndices.length === 0) return null

  const canonicalKeysByLabel = new Map<string, string>()
  const globalUsedKeys = new Set<string>()
  const blocks: DetectedColumnBlock[] = []

  if (itemIndices.length === 1) {
    const single = detectColumnBlockInSlice(
      headerRow,
      dataRows,
      0,
      headerRow.length,
      canonicalKeysByLabel,
      globalUsedKeys,
    )
    if (!single) return null
    blocks.push(single)
  } else {
    for (let idx = 0; idx < itemIndices.length; idx += 1) {
      const curItemCol = itemIndices[idx]!
      const prevEnd = idx === 0 ? 0 : blocks[blocks.length - 1]
        ? Math.max(
            blocks[blocks.length - 1]!.itemCol + 1,
            ...(blocks[blocks.length - 1]!.proposedCols.map((p) => p.colIndex + 1)),
            blocks[blocks.length - 1]!.currentCol !== null ? blocks[blocks.length - 1]!.currentCol! + 1 : 0,
          )
        : 0
      const sliceStart = idx === 0 ? 0 : Math.min(curItemCol, Math.max(prevEnd, curItemCol - 1))
      const nextItemCol = itemIndices[idx + 1]
      let sliceEnd = headerRow.length
      if (nextItemCol !== undefined) {
        const maybeBrandBeforeNext =
          nextItemCol > curItemCol + 1 &&
          isBrandHeader(normalizeHeaderToken((headerRow[nextItemCol - 1] ?? '').trim()))
        sliceEnd = maybeBrandBeforeNext ? nextItemCol - 1 : nextItemCol
      }

      const block = detectColumnBlockInSlice(
        headerRow,
        dataRows,
        sliceStart,
        sliceEnd,
        canonicalKeysByLabel,
        globalUsedKeys,
      )
      if (block && block.proposedCols.length > 0) {
        blocks.push(block)
      }
    }
  }

  return blocks.length > 0 ? { headerRowIndex: bestRowIdx, blocks } : null
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

  const allExtracted: RawExtractedIntakeRow[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const grid = extractSheetGridPreservingRawDecimals(sheet)
    if (grid.length < 2) continue

    const layout = detectSpreadsheetLayout(grid)
    if (!layout) continue

    const dataRows = grid.slice(layout.headerRowIndex + 1)

    for (const block of layout.blocks) {
      for (const row of dataRows) {
        const itemName = (row[block.itemCol] ?? '').replace(/\s+/g, ' ').trim()
        if (!itemName || isSummaryFooterItemName(itemName)) continue

        const rawBrand = block.brandCol !== null ? (row[block.brandCol] ?? '').trim() : ''
        const rawCurrent = block.currentCol !== null ? (row[block.currentCol] ?? '').trim() : ''

        const proposedOptions: ExtractedProposedOption[] = block.proposedCols.map((col) => ({
          optionKey: col.optionKey,
          label: col.label,
          proposedPriceKwd: (row[col.colIndex] ?? '').trim(),
        }))

        const itemHeaderEcho =
          isItemHeader(normalizeHeaderToken(itemName)) &&
          proposedOptions.every((opt) => !looksLikeNumericCell(opt.proposedPriceKwd))
        if (itemHeaderEcho) continue

        // Skip pure category section banner rows (no current price and all proposed cells empty)
        const allPricesBlank =
          rawCurrent.length === 0 &&
          proposedOptions.every((opt) => opt.proposedPriceKwd.length === 0)
        if (allPricesBlank) continue

        allExtracted.push({
          brand: rawBrand || null,
          itemName,
          sheetCurrentPriceKwd: rawCurrent || null,
          proposedOptions,
        })
      }
    }

    if (allExtracted.length > 0) {
      return allExtracted
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

export const visionExtractedTableSchema = z.object({
  table_title: z.string().trim().nullable().optional(),
  brand: z.string().trim().nullable().optional(),
  rows: z.array(visionExtractedRowSchema),
})

export const visionExtractionPayloadSchema = z
  .object({
    detected_rotation_degrees: z
      .union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
      .optional(),
    brand: z.string().trim().nullable().optional(),
    rows: z.array(visionExtractedRowSchema).optional(),
    tables: z.array(visionExtractedTableSchema).optional(),
  })
  .refine((val) => Array.isArray(val.rows) || Array.isArray(val.tables), {
    message: 'Vision payload must include rows or tables array.',
  })

export type VisionExtractionPayload = z.infer<typeof visionExtractionPayloadSchema>

const VISION_SYSTEM_PROMPT = [
  'You extract structured restaurant menu pricing rows from an uploaded printed or photographed price sheet in Kuwait (KWD).',
  'Return STRICT JSON ONLY matching this exact schema:',
  '{"detected_rotation_degrees":0|90|180|270,"brand":string|null,"rows":[{"brand":string|null,"item_name":string,"current_price":string|null,"proposed_options":[{"option_key":string,"label":string,"proposed_price":string}]}]}',
  'CRITICAL MULTI-TABLE & ROTATION EXTRACTION RULES:',
  '1) ROTATED PHOTOS: If the document photo is sideways (90° CW or 270° CW) or upside-down (180°), mentally orient the sheet upright first so every item row stays strictly aligned with its own price columns across the row, and report "detected_rotation_degrees".',
  '2) MULTI-TABLE PAGES: Scan ALL tables on the page completely — including side-by-side 2-column or 3-column menu tables (left table, middle table, right table) AND stacked category tables (Appetizers, Soups, Rice, Noodles, Chicken, Beef, Seafood, Vegetables, Drinks). Flatten every menu item row from every table into "rows" in reading order without skipping any table or section.',
  '3) CURRENT PRICE vs INCREASE DELTA vs SUGGESTED OPTIONS: Printed Venture Foods sheets often have columns like "Item Name | Price | Increase | CH Suggested | AE Suggested":',
  '   - Map "Price" (or "Current Price") to "current_price".',
  '   - NEVER include "Increase", "Delta", "Diff", or "% Change" columns inside "proposed_options" (those are price deltas like 0.200, NOT unit prices!).',
  '   - Extract every target price column (such as "CH Suggested" and "AE Suggested", or "CH" and "AE") as distinct entries in "proposed_options" in column order.',
  '   - If only one proposed price column exists, set label to its header (or "Proposed") and option_key to "proposed".',
  '4) EXACT FIDELITY: Copy every digit EXACTLY as printed (preserve trailing zeros like "1.950", "2.250", "0.450") and preserve exact item names including parenthetical qualifiers like "(Pan Fry & Steamed)" or "(For 6)". Never invent items or calculate numbers.',
  '5) BRAND HEADER: If a restaurant brand name/logo is printed in the sheet header or title (e.g. "China Garden", "Frank\'s", "Tahina", "The Noodle Bar", "Farm Brown", "Karak Cafeteria"), populate "brand" on each row (or top-level "brand"). Skip category section headers that have no prices and skip summary/total footer rows.',
].join('\n')

const VISION_USER_PROMPT =
  'Extract EVERY menu item pricing row across ALL tables and columns on this page as strict JSON with exact string KWD prices (keep Price as current_price, ignore Increase/Delta columns, and capture all Suggested/Proposed columns such as CH Suggested and AE Suggested).'

const VISION_ROTATION_RETRY_PROMPT =
  'IMPORTANT: This menu price sheet may be rotated sideways (90°/270°) or upside-down (180°) and may contain multiple side-by-side tables. Re-orient upright carefully and extract EVERY menu item row with exact KWD prices into strict JSON.'

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
      if (!rec || rec.thought === true || typeof rec.text !== 'string') return ''
      return rec.text
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
  userPrompt: string
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
              { text: input.userPrompt },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: VISION_MAX_OUTPUT_TOKENS,
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
  userPrompt: string
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
        max_tokens: VISION_MAX_OUTPUT_TOKENS,
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
              { type: 'text', text: input.userPrompt },
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
  const sheetDefaultBrand = payload.brand && payload.brand.trim() ? payload.brand.trim() : null

  const combinedRawRows: Array<z.infer<typeof visionExtractedRowSchema>> = []
  if (Array.isArray(payload.tables)) {
    for (const tbl of payload.tables) {
      const tblBrand =
        (tbl.brand && tbl.brand.trim() ? tbl.brand.trim() : null) ?? sheetDefaultBrand
      for (const r of tbl.rows) {
        combinedRawRows.push({
          ...r,
          brand: r.brand && r.brand.trim() ? r.brand.trim() : tblBrand,
        })
      }
    }
  }
  if (Array.isArray(payload.rows)) {
    for (const r of payload.rows) {
      combinedRawRows.push({
        ...r,
        brand: r.brand && r.brand.trim() ? r.brand.trim() : sheetDefaultBrand,
      })
    }
  }

  const normalizedRows: RawExtractedIntakeRow[] = []

  for (const row of combinedRawRows) {
    const trimmedName = row.item_name.trim()
    if (!trimmedName || isSummaryFooterItemName(trimmedName)) continue

    const rawCurrent = row.current_price == null ? '' : String(row.current_price).trim()

    // Filter out Increase / Delta / % Change columns if the model emitted them in proposed_options
    const nonDeltaOptions = row.proposed_options.filter((opt) => {
      const normLabel = normalizeHeaderToken(opt.label)
      const normKey = normalizeHeaderToken(opt.option_key ?? '')
      return !isDeltaOrIncreaseLabel(normLabel) && !isDeltaOrIncreaseLabel(normKey)
    })

    // Skip pure category section header banners that have neither current_price nor proposed_options
    if (!rawCurrent && nonDeltaOptions.length === 0 && row.proposed_options.length === 0) {
      continue
    }

    const rowUsedKeys = new Set<string>()
    const proposedOptions: ExtractedProposedOption[] = nonDeltaOptions.map((opt, idx) => {
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

    normalizedRows.push({
      brand: row.brand && row.brand.trim() ? row.brand.trim() : null,
      itemName: trimmedName,
      sheetCurrentPriceKwd: rawCurrent || null,
      proposedOptions,
    })
  }

  return normalizedRows
}

export interface VisionExtractOptions {
  fetchImpl?: typeof fetch
  keys?: CouncilKeys
  models?: CouncilModels
  timeoutMs?: number
  rotationDegrees?: IntakeRotationDegrees | null
  visionExtractOverride?: (input: {
    bytes: Uint8Array
    mimeType: string
    fileName: string
  }) => Promise<unknown>
}

async function runSingleVisionPass(params: {
  bytes: Uint8Array
  mimeType: string
  userPrompt: string
  hasGoogle: boolean
  hasAnthropic: boolean
  keys: CouncilKeys
  models: CouncilModels
  timeoutMs: number
  fetchImpl: typeof fetch
}): Promise<string | null> {
  const base64Data = Buffer.from(params.bytes).toString('base64')
  let rawJsonText: string | null = null

  if (params.hasGoogle) {
    rawJsonText = await callGeminiVision({
      apiKey: params.keys.google.trim(),
      model: params.models.google,
      base64Data,
      mimeType: params.mimeType,
      userPrompt: params.userPrompt,
      timeoutMs: params.timeoutMs,
      fetchImpl: params.fetchImpl,
    })
  }

  if (!rawJsonText && params.hasAnthropic) {
    rawJsonText = await callAnthropicVision({
      apiKey: params.keys.anthropic.trim(),
      model: params.models.anthropic,
      base64Data,
      mimeType: params.mimeType,
      userPrompt: params.userPrompt,
      timeoutMs: params.timeoutMs,
      fetchImpl: params.fetchImpl,
    })
  }

  return rawJsonText
}

export async function extractVisionIntakeRows(
  input: {
    bytes: Uint8Array
    mimeType: string
    fileName: string
  },
  options: VisionExtractOptions = {},
): Promise<RawExtractedIntakeRow[]> {
  const oriented = await normalizeIntakeImageOrientation(
    input.bytes,
    input.mimeType,
    options.rotationDegrees ?? 0,
  )

  if (options.visionExtractOverride) {
    const rawOverride = await options.visionExtractOverride({
      bytes: oriented.bytes,
      mimeType: oriented.mimeType,
      fileName: input.fileName,
    })
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

  const initialPrompt =
    oriented.appliedDegrees !== 0 && !oriented.normalizedBySharp
      ? `${VISION_USER_PROMPT} (Note: EXIF orientation indicates ${oriented.appliedDegrees}° clockwise rotation — read text upright.)`
      : VISION_USER_PROMPT

  const rawJsonText = await runSingleVisionPass({
    bytes: oriented.bytes,
    mimeType: oriented.mimeType,
    userPrompt: initialPrompt,
    hasGoogle,
    hasAnthropic,
    keys,
    models,
    timeoutMs,
    fetchImpl,
  })

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

  const initialRows = normalizeVisionPayloadToRows(validated.data)
  if (initialRows.length > 0) {
    return initialRows
  }

  // Automatic orientation retry if initial pass found 0 rows (e.g. rotated printed sheet without EXIF tag)
  const retryDegrees: IntakeRotationDegrees = validated.data.detected_rotation_degrees || 90

  const rotatedRetry = await normalizeIntakeImageOrientation(
    oriented.bytes,
    oriented.mimeType,
    retryDegrees,
  )

  const retryText = await runSingleVisionPass({
    bytes: rotatedRetry.bytes,
    mimeType: rotatedRetry.mimeType,
    userPrompt: VISION_ROTATION_RETRY_PROMPT,
    hasGoogle,
    hasAnthropic,
    keys,
    models,
    timeoutMs,
    fetchImpl,
  })

  if (retryText) {
    try {
      const retryDecoded: unknown = JSON.parse(stripCodeFences(retryText))
      const retryValidated = visionExtractionPayloadSchema.safeParse(retryDecoded)
      if (retryValidated.success) {
        const retryRows = normalizeVisionPayloadToRows(retryValidated.data)
        if (retryRows.length > 0) {
          return retryRows
        }
      }
    } catch {
      // Return initialRows if retry JSON failed
    }
  }

  return initialRows
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
    if (!hasCompatibleFlavorProteinTokens(itemName, row.name)) {
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
  const explicitDraftBrandId = resolveIntakeBrandId(input.brand)
  const inferredSheetBrandId = resolveIntakeBrandId(
    inferConfirmedSheetBrandId({ rows: input.extractedRows }),
  )
  const effectiveBrandId = explicitDraftBrandId ?? inferredSheetBrandId

  // Restrict candidate Odoo SKUs to effectiveBrandId when known (preserving unbranded rows)
  const scopedOdooRows = effectiveBrandId
    ? input.odooRows.filter((row) => {
        const candBrand = resolveCanonicalBrandId(row.brandId) ?? inferBrandIdFromSkuName(row.name)
        return candBrand === null || candBrand === effectiveBrandId
      })
    : input.odooRows

  const odooRowById = new Map<number, ItemPricingRow>(
    scopedOdooRows.map((row) => [row.productId, row]),
  )

  const assignments = enforceOneToOneSkuMatches(
    input.extractedRows.map((extracted, idx) => ({
      rowIndex: idx,
      itemName: extracted.itemName,
      brand: extracted.brand ?? effectiveBrandId,
      currentPriceKwd: extracted.sheetCurrentPriceKwd,
      excluded: false,
    })),
    scopedOdooRows.map((row) => ({
      productId: row.productId,
      name: row.name,
      unitPriceKwd: formatOdooUnitPriceOrNull(row),
      netSalesKwd: row.netKwd,
      brandId: row.brandId ?? null,
    })),
    { contextBrand: explicitDraftBrandId ?? effectiveBrandId },
  )

  const initialRows: DocumentIntakeRow[] = input.extractedRows.map((extracted, idx) => {
    const assignment = assignments[idx]
    const matched =
      assignment?.matched && assignment.productId != null
        ? (odooRowById.get(assignment.productId) ?? null)
        : null

    let rejectedVariantHint: RejectedVariantHint | null = null
    if (!matched && assignment?.rejectedHint) {
      const hint = assignment.rejectedHint
      if (hint.reason === 'duplicate_sku_collision') {
        rejectedVariantHint = {
          odooName: hint.odooName,
          odooUnitPriceKwd: hint.odooUnitPriceKwd,
          diffPct: hint.diffPct,
          reason: 'duplicate_sku_collision',
          collidedProductId: hint.odooProductId,
        }
      } else {
        rejectedVariantHint = {
          odooName: hint.odooName,
          odooUnitPriceKwd: hint.odooUnitPriceKwd,
          diffPct: hint.diffPct,
        }
      }
    }

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
      rejectedVariantHint,
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
    ...(effectiveBrandId ? { brandId: effectiveBrandId } : {}),
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
  rotationDegrees?: IntakeRotationDegrees | null
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

  const explicitBrandId = validatedDefaults.brandId ?? resolveIntakeBrandId(input.brand)
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

  const effectiveRotation = input.rotationDegrees ?? options.rotationDegrees ?? 0

  const extractedRows =
    detected.fileKind === 'image'
      ? await extractVisionIntakeRows(
          {
            bytes: input.bytes,
            mimeType: detected.normalizedMime,
            fileName: input.fileName,
          },
          {
            ...options,
            rotationDegrees: effectiveRotation,
          },
        )
      : parseSpreadsheetIntakeRows(input.bytes)

  const inferredSheetBrandId = resolveIntakeBrandId(
    inferConfirmedSheetBrandId({ rows: extractedRows }),
  )
  const effectiveOdooBrandId = explicitBrandId ?? inferredSheetBrandId

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
        posRoot: posRootForBrand(effectiveOdooBrandId),
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
    brand: explicitBrandId,
    branch: branchId,
    extractedRows,
    odooRows,
  })
}
