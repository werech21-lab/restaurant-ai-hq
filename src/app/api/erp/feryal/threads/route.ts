import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'
import {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireExecApiSession,
} from '@/lib/auth/api-guard'
import { prisma } from '@/lib/db'
import { sslOptions, type SslMode } from '@/lib/db-ssl'
import type {
  ActivePriceSheetThreadContext,
  FeryalChatThread,
  FeryalNotebook,
  FrozenMessageScope,
  StoredChatMessage,
} from '@/lib/feryal-chat-store'
import {
  isConfirmedPriceSheet,
  USER_INPUT_CONFIRMED_LABEL,
  type ConfirmedPriceSheet,
  type ConfirmedPriceSheetRow,
  type ExtractedProposedOption,
} from '@/lib/feryal/document-intake-types'
import type { StoredAttachmentMeta, VisionComplianceTier } from '@/lib/feryal-multimodal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_THREADS_PER_USER = 100
const MAX_MESSAGES_PER_THREAD = 200
const MAX_MESSAGE_TEXT_CHARS = 24_000
const MAX_THUMB_DATA_URL_CHARS = 64_000
const MAX_REQUEST_BODY_CHARS = 2_500_000

const ENTITY_THREAD_PREFIX = 'feryal_chat_thread_v1:'
const ENTITY_NOTEBOOKS_PREFIX = 'feryal_chat_notebooks_v1:'
const PG_ROW_PREFIX = 'feryal-threads:v1:'
const PG_NO_PIN_MARKER = 'feryal-threads-v1'

interface UserThreadStoreBucket {
  threads: Map<string, FeryalChatThread>
  notebooks: FeryalNotebook[]
}

const globalForFeryalThreads = globalThis as unknown as {
  __vfFeryalThreadsPgPool?: Pool | null
  __vfFeryalThreadsPgHealthy?: boolean
  __vfFeryalThreadsPgCheckedAt?: number
  __vfFeryalThreadsFallback?: Map<string, UserThreadStoreBucket>
}

function getFallbackMap(): Map<string, UserThreadStoreBucket> {
  if (!globalForFeryalThreads.__vfFeryalThreadsFallback) {
    globalForFeryalThreads.__vfFeryalThreadsFallback = new Map<string, UserThreadStoreBucket>()
  }
  return globalForFeryalThreads.__vfFeryalThreadsFallback
}

function getUserFallbackBucket(userKey: string): UserThreadStoreBucket {
  const map = getFallbackMap()
  let bucket = map.get(userKey)
  if (!bucket) {
    bucket = { threads: new Map<string, FeryalChatThread>(), notebooks: [] }
    map.set(userKey, bucket)
  }
  return bucket
}

function getThreadsPgPool(): Pool | null {
  const dbUrl = (process.env.DATABASE_URL ?? '').trim()
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    return null
  }
  if (
    globalForFeryalThreads.__vfFeryalThreadsPgHealthy === false &&
    globalForFeryalThreads.__vfFeryalThreadsPgCheckedAt &&
    Date.now() - globalForFeryalThreads.__vfFeryalThreadsPgCheckedAt < 30_000
  ) {
    return null
  }
  if (globalForFeryalThreads.__vfFeryalThreadsPgPool) {
    return globalForFeryalThreads.__vfFeryalThreadsPgPool
  }
  try {
    const rawSsl = (process.env.DATABASE_SSL ?? 'require').trim()
    const sslMode: SslMode =
      rawSsl === 'disable' || rawSsl === 'verify' ? rawSsl : 'require'
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: sslOptions(sslMode, process.env.DATABASE_SSL_CA),
      max: 1,
      connectionTimeoutMillis: 2200,
      idleTimeoutMillis: 10_000,
    })
    pool.on('error', () => {
      globalForFeryalThreads.__vfFeryalThreadsPgHealthy = false
      globalForFeryalThreads.__vfFeryalThreadsPgCheckedAt = Date.now()
    })
    globalForFeryalThreads.__vfFeryalThreadsPgPool = pool
    return pool
  } catch {
    globalForFeryalThreads.__vfFeryalThreadsPgHealthy = false
    globalForFeryalThreads.__vfFeryalThreadsPgCheckedAt = Date.now()
    return null
  }
}

function resolveSessionUserKey(session: unknown): string | null {
  if (!session || typeof session !== 'object') return null
  const rec = session as { sub?: unknown; email?: unknown; userId?: unknown }
  const raw =
    (typeof rec.email === 'string' && rec.email.trim()) ||
    (typeof rec.userId === 'string' && rec.userId.trim()) ||
    (typeof rec.sub === 'string' && rec.sub.trim()) ||
    ''
  if (!raw) return null
  return raw.toLowerCase().slice(0, 160)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function sanitizeAttachmentMeta(raw: unknown): StoredAttachmentMeta | null {
  const rec = asRecord(raw)
  if (!rec) return null
  const id = typeof rec.id === 'string' ? rec.id.trim().slice(0, 96) : ''
  const name = typeof rec.name === 'string' ? rec.name.trim().slice(0, 160) : 'attachment'
  if (!id) return null
  const kind: 'image' | 'video' = rec.kind === 'video' ? 'video' : 'image'
  const rawThumb = typeof rec.thumbDataUrl === 'string' ? rec.thumbDataUrl : ''
  const thumbDataUrl = rawThumb.length <= MAX_THUMB_DATA_URL_CHARS ? rawThumb : ''

  const frameThumbs = Array.isArray(rec.frameThumbs)
    ? rec.frameThumbs
        .slice(0, 4)
        .map((ft) => {
          const ftRec = asRecord(ft)
          if (!ftRec) return null
          const ftThumb = typeof ftRec.thumbDataUrl === 'string' ? ftRec.thumbDataUrl : ''
          if (!ftThumb || ftThumb.length > MAX_THUMB_DATA_URL_CHARS) return null
          return {
            timestampLabel:
              typeof ftRec.timestampLabel === 'string'
                ? ftRec.timestampLabel.slice(0, 24)
                : '00:00',
            thumbDataUrl: ftThumb,
          }
        })
        .filter((x): x is { timestampLabel: string; thumbDataUrl: string } => x !== null)
    : undefined

  return {
    id,
    kind,
    name,
    ...(typeof rec.sizeBytes === 'number' && Number.isFinite(rec.sizeBytes)
      ? { sizeBytes: Math.max(0, Math.round(rec.sizeBytes)) }
      : {}),
    ...(typeof rec.durationSec === 'number' && Number.isFinite(rec.durationSec)
      ? { durationSec: Number(rec.durationSec) }
      : {}),
    ...(typeof rec.frameCount === 'number' && Number.isFinite(rec.frameCount)
      ? { frameCount: Math.max(0, Math.round(rec.frameCount)) }
      : {}),
    thumbDataUrl,
    ...(frameThumbs && frameThumbs.length > 0 ? { frameThumbs } : {}),
  }
}

function sanitizeComplianceTier(value: unknown): VisionComplianceTier | undefined {
  if (value === 'green' || value === 'yellow' || value === 'red') return value
  return undefined
}

function sanitizeFrozenScope(raw: unknown): FrozenMessageScope | undefined {
  const rec = asRecord(raw)
  if (!rec) return undefined
  const periodLabel =
    typeof rec.periodLabel === 'string' ? rec.periodLabel.trim().slice(0, 180) : ''
  const dateFrom = typeof rec.dateFrom === 'string' ? rec.dateFrom.trim().slice(0, 32) : ''
  const dateTo = typeof rec.dateTo === 'string' ? rec.dateTo.trim().slice(0, 32) : ''
  const brandScope =
    typeof rec.brandScope === 'string' ? rec.brandScope.trim().slice(0, 120) : ''
  if (!periodLabel && !dateFrom && !brandScope) return undefined
  return {
    ...(typeof rec.periodKey === 'string' && rec.periodKey.trim()
      ? { periodKey: rec.periodKey.trim().slice(0, 48) }
      : {}),
    periodLabel,
    dateFrom,
    dateTo,
    brandScope,
    ...(typeof rec.branchScope === 'string' && rec.branchScope.trim()
      ? { branchScope: rec.branchScope.trim().slice(0, 120) }
      : {}),
    ...(typeof rec.channelScope === 'string' && rec.channelScope.trim()
      ? { channelScope: rec.channelScope.trim().slice(0, 120) }
      : {}),
  }
}

const MAX_CONFIRMED_SHEET_ROWS = 500
const MAX_OPTIONS_PER_ROW = 12

function sanitizeConfirmedPriceSheet(raw: unknown): ConfirmedPriceSheet | null {
  if (!isConfirmedPriceSheet(raw)) return null
  const draftId = raw.draftId.trim().slice(0, 128)
  if (!draftId) return null
  const fileName = raw.fileName.trim().slice(0, 180) || 'price-sheet'
  const confirmedAtIso =
    raw.confirmedAtIso.trim().slice(0, 64) || new Date().toISOString()

  const rows: ConfirmedPriceSheetRow[] = []
  for (let i = 0; i < Math.min(raw.rows.length, MAX_CONFIRMED_SHEET_ROWS); i++) {
    const rowRec = asRecord(raw.rows[i])
    if (!rowRec) continue
    const itemName =
      typeof rowRec.itemName === 'string' ? rowRec.itemName.trim().slice(0, 240) : ''
    if (!itemName) continue
    const rowId =
      typeof rowRec.rowId === 'string' && rowRec.rowId.trim()
        ? rowRec.rowId.trim().slice(0, 96)
        : `row-${i + 1}`
    const brand =
      typeof rowRec.brand === 'string' && rowRec.brand.trim()
        ? rowRec.brand.trim().slice(0, 120)
        : null
    const currentPriceKwd =
      typeof rowRec.currentPriceKwd === 'string' && rowRec.currentPriceKwd.trim()
        ? rowRec.currentPriceKwd.trim().slice(0, 32)
        : null
    const matchedOdooProductId =
      typeof rowRec.matchedOdooProductId === 'number' &&
      Number.isFinite(rowRec.matchedOdooProductId)
        ? Math.trunc(rowRec.matchedOdooProductId)
        : null

    const rawOpts = Array.isArray(rowRec.proposedOptions) ? rowRec.proposedOptions : []
    const proposedOptions: ExtractedProposedOption[] = []
    for (let j = 0; j < Math.min(rawOpts.length, MAX_OPTIONS_PER_ROW); j++) {
      const optRec = asRecord(rawOpts[j])
      if (!optRec) continue
      const proposedPriceKwd =
        typeof optRec.proposedPriceKwd === 'string'
          ? optRec.proposedPriceKwd.trim().slice(0, 32)
          : ''
      if (!proposedPriceKwd) continue
      const optionKey =
        typeof optRec.optionKey === 'string' && optRec.optionKey.trim()
          ? optRec.optionKey.trim().slice(0, 64)
          : `opt-${j + 1}`
      const label =
        typeof optRec.label === 'string' && optRec.label.trim()
          ? optRec.label.trim().slice(0, 96)
          : optionKey
      proposedOptions.push({ optionKey, label, proposedPriceKwd })
    }

    rows.push({
      rowId,
      brand,
      itemName,
      currentPriceKwd,
      proposedOptions,
      matchedOdooProductId,
    })
  }

  if (rows.length === 0) return null

  return {
    draftId,
    fileName,
    sourceTag: USER_INPUT_CONFIRMED_LABEL,
    confirmedAtIso,
    rows,
  }
}

function sanitizeActivePriceSheetContext(
  raw: unknown,
): ActivePriceSheetThreadContext | null | undefined {
  if (raw === undefined) return undefined
  if (raw === null) return null
  const rec = asRecord(raw)
  if (!rec) return undefined
  const confirmedPriceSheet = sanitizeConfirmedPriceSheet(rec.confirmedPriceSheet)
  if (!confirmedPriceSheet) return undefined

  const confirmedAtIso =
    typeof rec.confirmedAtIso === 'string' && rec.confirmedAtIso.trim()
      ? rec.confirmedAtIso.trim().slice(0, 64)
      : confirmedPriceSheet.confirmedAtIso
  const fileName =
    typeof rec.fileName === 'string' && rec.fileName.trim()
      ? rec.fileName.trim().slice(0, 180)
      : confirmedPriceSheet.fileName
  const brandScope =
    typeof rec.brandScope === 'string' && rec.brandScope.trim()
      ? rec.brandScope.trim().slice(0, 120)
      : null
  const periodLabel =
    typeof rec.periodLabel === 'string' && rec.periodLabel.trim()
      ? rec.periodLabel.trim().slice(0, 180)
      : null
  const dateFrom =
    typeof rec.dateFrom === 'string' && rec.dateFrom.trim()
      ? rec.dateFrom.trim().slice(0, 32)
      : null
  const dateTo =
    typeof rec.dateTo === 'string' && rec.dateTo.trim()
      ? rec.dateTo.trim().slice(0, 32)
      : null
  const matchedSkuCount =
    typeof rec.matchedSkuCount === 'number' && Number.isFinite(rec.matchedSkuCount)
      ? Math.max(0, Math.round(rec.matchedSkuCount))
      : undefined
  const summaryMarkdown =
    typeof rec.summaryMarkdown === 'string' && rec.summaryMarkdown.trim()
      ? rec.summaryMarkdown.slice(0, MAX_MESSAGE_TEXT_CHARS)
      : null

  return {
    confirmedPriceSheet,
    confirmedAtIso,
    fileName,
    brandScope,
    periodLabel,
    dateFrom,
    dateTo,
    ...(matchedSkuCount !== undefined ? { matchedSkuCount } : {}),
    summaryMarkdown,
  }
}

function sanitizeMessage(raw: unknown, idx: number): StoredChatMessage | null {
  const rec = asRecord(raw)
  if (!rec) return null
  const text = typeof rec.text === 'string' ? rec.text.slice(0, MAX_MESSAGE_TEXT_CHARS) : ''
  const attachmentsMeta = Array.isArray(rec.attachmentsMeta)
    ? rec.attachmentsMeta
        .slice(0, 4)
        .map(sanitizeAttachmentMeta)
        .filter((x): x is StoredAttachmentMeta => x !== null)
    : undefined

  if (!text.trim() && (!attachmentsMeta || attachmentsMeta.length === 0)) {
    return null
  }

  const sender: 'user' | 'feryal' = rec.sender === 'user' ? 'user' : 'feryal'
  const id =
    typeof rec.id === 'string' && rec.id.trim().length > 0
      ? rec.id.trim().slice(0, 96)
      : `msg-${idx + 1}`
  const time = typeof rec.time === 'string' ? rec.time.slice(0, 32) : ''
  const visionCompliance = sanitizeComplianceTier(rec.visionCompliance ?? rec.complianceTier)
  const frozenScope = sanitizeFrozenScope(rec.frozenScope)

  const msg: StoredChatMessage = {
    id,
    sender,
    text,
    time,
    ...(frozenScope ? { frozenScope } : {}),
    ...(attachmentsMeta && attachmentsMeta.length > 0 ? { attachmentsMeta } : {}),
    ...(visionCompliance ? { visionCompliance } : {}),
    ...(typeof rec.engineLabelAr === 'string'
      ? { engineLabelAr: rec.engineLabelAr.slice(0, 160) }
      : typeof rec.providerBadge === 'string'
        ? { engineLabelAr: rec.providerBadge.slice(0, 160) }
        : {}),
    ...(typeof rec.engineLabelEn === 'string'
      ? { engineLabelEn: rec.engineLabelEn.slice(0, 160) }
      : {}),
    ...(typeof rec.statusNoteAr === 'string'
      ? { statusNoteAr: rec.statusNoteAr.slice(0, 240) }
      : typeof rec.learnedBadge === 'string'
        ? { statusNoteAr: rec.learnedBadge.slice(0, 240) }
        : {}),
    ...(typeof rec.statusNoteEn === 'string'
      ? { statusNoteEn: rec.statusNoteEn.slice(0, 240) }
      : {}),
    ...(typeof rec.userPrompt === 'string'
      ? { userPrompt: rec.userPrompt.slice(0, 2000) }
      : {}),
    ...(typeof rec.replyStatus === 'string'
      ? { replyStatus: rec.replyStatus.slice(0, 64) }
      : {}),
    ...(typeof rec.contradictoryActions === 'boolean'
      ? { contradictoryActions: rec.contradictoryActions }
      : {}),
    ...(Array.isArray(rec.executedQueries)
      ? { executedQueries: rec.executedQueries.slice(0, 12) as StoredChatMessage['executedQueries'] }
      : {}),
    ...(asRecord(rec.verifier)
      ? { verifier: rec.verifier as StoredChatMessage['verifier'] }
      : {}),
    ...(Array.isArray(rec.council)
      ? { council: rec.council.slice(0, 6) as StoredChatMessage['council'] }
      : {}),
    ...(Array.isArray(rec.agreed)
      ? { agreed: rec.agreed.slice(0, 6) as StoredChatMessage['agreed'] }
      : {}),
  }

  return msg
}

function sanitizeThread(raw: unknown): FeryalChatThread | null {
  const rec = asRecord(raw)
  if (!rec) return null
  const id = typeof rec.id === 'string' ? rec.id.trim().slice(0, 128) : ''
  if (!id) return null

  const rawMsgs = Array.isArray(rec.messages) ? rec.messages : []
  const messages: StoredChatMessage[] = []
  for (let i = 0; i < Math.min(rawMsgs.length, MAX_MESSAGES_PER_THREAD); i++) {
    const clean = sanitizeMessage(rawMsgs[i], i)
    if (clean) messages.push(clean)
  }
  if (messages.length === 0) return null

  const nowIso = new Date().toISOString()
  const firstUser = messages.find((m) => m.sender === 'user')?.text ?? messages[0]?.text ?? ''
  const rawTitle = typeof rec.title === 'string' ? rec.title.trim().slice(0, 180) : ''
  const title = rawTitle || firstUser.slice(0, 64) || 'محادثة فريال'
  const lastMsg = messages[messages.length - 1]
  const previewText =
    typeof rec.previewText === 'string' && rec.previewText.trim()
      ? rec.previewText.trim().slice(0, 140)
      : (lastMsg?.text ?? '').replace(/[#*`]/g, '').trim().slice(0, 120)
  const searchableCorpus =
    typeof rec.searchableCorpus === 'string' && rec.searchableCorpus.trim()
      ? rec.searchableCorpus.slice(0, 4000)
      : messages
          .map((m) => m.text)
          .join(' ')
          .slice(0, 4000)

  const createdAt =
    typeof rec.createdAt === 'string' && !Number.isNaN(Date.parse(rec.createdAt))
      ? rec.createdAt
      : nowIso
  const updatedAt =
    typeof rec.updatedAt === 'string' && !Number.isNaN(Date.parse(rec.updatedAt))
      ? rec.updatedAt
      : nowIso

  const activePriceSheetContext = sanitizeActivePriceSheetContext(rec.activePriceSheetContext)

  return {
    id,
    title,
    notebookId:
      typeof rec.notebookId === 'string' && rec.notebookId.trim()
        ? rec.notebookId.trim().slice(0, 96)
        : 'nb-branches-pricing',
    pinned: Boolean(rec.pinned),
    lang: rec.lang === 'en' ? 'en' : 'ar',
    messageCount: messages.length,
    previewText,
    searchableCorpus,
    ...(typeof rec.filterLabel === 'string' && rec.filterLabel.trim()
      ? { filterLabel: rec.filterLabel.trim().slice(0, 180) }
      : {}),
    createdAt,
    updatedAt,
    messages,
    ...(activePriceSheetContext !== undefined ? { activePriceSheetContext } : {}),
  }
}

function sanitizeNotebook(raw: unknown): FeryalNotebook | null {
  const rec = asRecord(raw)
  if (!rec) return null
  const id = typeof rec.id === 'string' ? rec.id.trim().slice(0, 96) : ''
  const nameAr = typeof rec.nameAr === 'string' ? rec.nameAr.trim().slice(0, 96) : ''
  if (!id || !nameAr) return null
  return {
    id,
    nameAr,
    nameEn:
      typeof rec.nameEn === 'string' && rec.nameEn.trim()
        ? rec.nameEn.trim().slice(0, 96)
        : nameAr,
    icon: typeof rec.icon === 'string' && rec.icon.trim() ? rec.icon.trim().slice(0, 8) : '📁',
    isDefault: Boolean(rec.isDefault),
    createdAt:
      typeof rec.createdAt === 'string' && !Number.isNaN(Date.parse(rec.createdAt))
        ? rec.createdAt
        : new Date().toISOString(),
  }
}

function sortAndCapThreads(threads: readonly FeryalChatThread[]): FeryalChatThread[] {
  return [...threads]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, MAX_THREADS_PER_USER)
}

async function readUserStoreFromPostgres(userKey: string): Promise<{
  threads: FeryalChatThread[]
  notebooks: FeryalNotebook[]
} | null> {
  const pool = getThreadsPgPool()
  if (!pool) return null
  try {
    const pgId = `${PG_ROW_PREFIX}${userKey}`
    const res = await pool.query<{ payload: unknown }>(
      `SELECT payload FROM public.vf_executive_governance_sync WHERE id = $1`,
      [pgId],
    )
    globalForFeryalThreads.__vfFeryalThreadsPgHealthy = true
    globalForFeryalThreads.__vfFeryalThreadsPgCheckedAt = Date.now()
    if (res.rows.length === 0) {
      return { threads: [], notebooks: [] }
    }
    const rawPayload = res.rows[0]?.payload
    const parsed =
      typeof rawPayload === 'string' ? (JSON.parse(rawPayload) as unknown) : rawPayload
    const rec = asRecord(parsed)
    const threads = Array.isArray(rec?.threads)
      ? rec.threads.map(sanitizeThread).filter((t): t is FeryalChatThread => t !== null)
      : []
    const notebooks = Array.isArray(rec?.notebooks)
      ? rec.notebooks.map(sanitizeNotebook).filter((n): n is FeryalNotebook => n !== null)
      : []
    return {
      threads: sortAndCapThreads(threads),
      notebooks,
    }
  } catch {
    globalForFeryalThreads.__vfFeryalThreadsPgHealthy = false
    globalForFeryalThreads.__vfFeryalThreadsPgCheckedAt = Date.now()
    return null
  }
}

async function writeUserStoreToPostgres(
  userKey: string,
  threads: readonly FeryalChatThread[],
  notebooks: readonly FeryalNotebook[],
): Promise<boolean> {
  const pool = getThreadsPgPool()
  if (!pool) return false
  try {
    const pgId = `${PG_ROW_PREFIX}${userKey}`
    const payload = JSON.stringify({
      userKey,
      threads: sortAndCapThreads(threads),
      notebooks: notebooks.slice(0, 32),
      updatedAt: new Date().toISOString(),
    })
    await pool.query(
      `INSERT INTO public.vf_executive_governance_sync (id, payload, pin_hash, updated_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (id)
       DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [pgId, payload, PG_NO_PIN_MARKER],
    )
    globalForFeryalThreads.__vfFeryalThreadsPgHealthy = true
    globalForFeryalThreads.__vfFeryalThreadsPgCheckedAt = Date.now()
    return true
  } catch {
    globalForFeryalThreads.__vfFeryalThreadsPgHealthy = false
    globalForFeryalThreads.__vfFeryalThreadsPgCheckedAt = Date.now()
    return false
  }
}

async function readUserStoreFromPrisma(userKey: string): Promise<{
  threads: FeryalChatThread[]
  notebooks: FeryalNotebook[]
} | null> {
  try {
    const entityType = `${ENTITY_THREAD_PREFIX}${userKey}`
    const nbEntityType = `${ENTITY_NOTEBOOKS_PREFIX}${userKey}`
    const [rows, nbRow] = await Promise.all([
      prisma.customFieldDefinition.findMany({
        where: { entityType },
      }),
      prisma.customFieldDefinition.findUnique({
        where: {
          entityType_fieldName: {
            entityType: nbEntityType,
            fieldName: 'notebooks',
          },
        },
      }),
    ])

    const threads: FeryalChatThread[] = []
    for (const row of rows) {
      try {
        const parsed = sanitizeThread(JSON.parse(row.options))
        if (parsed) threads.push(parsed)
      } catch {
        // skip malformed legacy entry
      }
    }

    let notebooks: FeryalNotebook[] = []
    if (nbRow?.options) {
      try {
        const rawNbs: unknown = JSON.parse(nbRow.options)
        if (Array.isArray(rawNbs)) {
          notebooks = rawNbs
            .map(sanitizeNotebook)
            .filter((n): n is FeryalNotebook => n !== null)
        }
      } catch {
        notebooks = []
      }
    }

    return {
      threads: sortAndCapThreads(threads),
      notebooks,
    }
  } catch {
    return null
  }
}

async function upsertThreadsInPrisma(
  userKey: string,
  incomingThreads: readonly FeryalChatThread[],
  incomingNotebooks?: readonly FeryalNotebook[],
): Promise<boolean> {
  try {
    const entityType = `${ENTITY_THREAD_PREFIX}${userKey}`
    for (const thread of incomingThreads) {
      const serialized = JSON.stringify(thread)
      await prisma.customFieldDefinition.upsert({
        where: {
          entityType_fieldName: {
            entityType,
            fieldName: thread.id,
          },
        },
        create: {
          entityType,
          fieldName: thread.id,
          fieldType: 'feryal_thread_json',
          options: serialized,
          isActive: false,
        },
        update: {
          fieldType: 'feryal_thread_json',
          options: serialized,
          isActive: false,
        },
      })
    }

    if (incomingNotebooks && incomingNotebooks.length > 0) {
      const nbEntityType = `${ENTITY_NOTEBOOKS_PREFIX}${userKey}`
      const serializedNbs = JSON.stringify(incomingNotebooks.slice(0, 32))
      await prisma.customFieldDefinition.upsert({
        where: {
          entityType_fieldName: {
            entityType: nbEntityType,
            fieldName: 'notebooks',
          },
        },
        create: {
          entityType: nbEntityType,
          fieldName: 'notebooks',
          fieldType: 'feryal_notebooks_json',
          options: serializedNbs,
          isActive: false,
        },
        update: {
          options: serializedNbs,
          isActive: false,
        },
      })
    }
    return true
  } catch {
    return false
  }
}

async function deleteThreadInPrisma(userKey: string, threadId: string): Promise<boolean> {
  try {
    const entityType = `${ENTITY_THREAD_PREFIX}${userKey}`
    await prisma.customFieldDefinition.deleteMany({
      where: {
        entityType,
        fieldName: threadId,
      },
    })
    return true
  } catch {
    return false
  }
}

async function loadUserThreads(userKey: string): Promise<{
  threads: FeryalChatThread[]
  notebooks: FeryalNotebook[]
}> {
  const fromPg = await readUserStoreFromPostgres(userKey)
  if (fromPg) {
    const bucket = getUserFallbackBucket(userKey)
    bucket.threads.clear()
    for (const t of fromPg.threads) bucket.threads.set(t.id, t)
    if (fromPg.notebooks.length > 0) bucket.notebooks = fromPg.notebooks
    return fromPg
  }

  const fromPrisma = await readUserStoreFromPrisma(userKey)
  if (fromPrisma) {
    const bucket = getUserFallbackBucket(userKey)
    bucket.threads.clear()
    for (const t of fromPrisma.threads) bucket.threads.set(t.id, t)
    if (fromPrisma.notebooks.length > 0) bucket.notebooks = fromPrisma.notebooks
    return fromPrisma
  }

  const fallback = getUserFallbackBucket(userKey)
  return {
    threads: sortAndCapThreads(Array.from(fallback.threads.values())),
    notebooks: [...fallback.notebooks],
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireExecApiSession(request, { allowAuditor: true })
  if (!guard.ok) return guard.response

  const userKey = resolveSessionUserKey(guard.session)
  if (!userKey) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required' },
      { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const requestedId = request.nextUrl.searchParams.get('id')?.trim() ?? ''
  const store = await loadUserThreads(userKey)

  if (requestedId) {
    const found = store.threads.find((t) => t.id === requestedId) ?? null
    return NextResponse.json(
      {
        ok: true,
        userKey,
        thread: found,
        timestamp: new Date().toISOString(),
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      userKey,
      threads: store.threads,
      notebooks: store.notebooks,
      timestamp: new Date().toISOString(),
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function POST(request: NextRequest) {
  const guard = await requireExecApiSession(request, { allowAuditor: false })
  if (!guard.ok) return guard.response

  if (guard.session.role === 'auditor') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Read-only auditor session',
        errorAr: 'حساب مراجعة للقراءة فقط — حفظ المحادثات غير متاح.',
      },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const userKey = resolveSessionUserKey(guard.session)
  if (!userKey) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required' },
      { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  let rawText = ''
  try {
    rawText = await request.text()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_BODY' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  if (rawText.length > MAX_REQUEST_BODY_CHARS) {
    return NextResponse.json(
      { ok: false, error: 'PAYLOAD_TOO_LARGE' },
      { status: 413, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawText)
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const body = asRecord(parsedJson)
  if (!body) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_JSON' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const incomingThreads: FeryalChatThread[] = []
  if (Array.isArray(body.threads)) {
    for (const item of body.threads.slice(0, MAX_THREADS_PER_USER)) {
      const clean = sanitizeThread(item)
      if (clean) incomingThreads.push(clean)
    }
  } else if (body.thread !== undefined) {
    const clean = sanitizeThread(body.thread)
    if (clean) incomingThreads.push(clean)
  } else {
    const directClean = sanitizeThread(body)
    if (directClean) incomingThreads.push(directClean)
  }

  const incomingNotebooks = Array.isArray(body.notebooks)
    ? body.notebooks.map(sanitizeNotebook).filter((n): n is FeryalNotebook => n !== null)
    : undefined

  if (incomingThreads.length === 0 && (!incomingNotebooks || incomingNotebooks.length === 0)) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_THREAD_PAYLOAD' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const current = await loadUserThreads(userKey)
  const mergedMap = new Map<string, FeryalChatThread>()
  for (const existing of current.threads) {
    mergedMap.set(existing.id, existing)
  }
  const resolvedIncomingThreads: FeryalChatThread[] = []
  for (const incoming of incomingThreads) {
    const prev = mergedMap.get(incoming.id)
    const preservedSheetCtx =
      incoming.activePriceSheetContext !== undefined
        ? incoming.activePriceSheetContext
        : prev?.activePriceSheetContext
    const nextThread: FeryalChatThread = {
      ...incoming,
      ...(preservedSheetCtx !== undefined
        ? { activePriceSheetContext: preservedSheetCtx }
        : {}),
    }
    resolvedIncomingThreads.push(nextThread)
    mergedMap.set(incoming.id, nextThread)
  }

  const mergedThreads = sortAndCapThreads(Array.from(mergedMap.values()))
  const mergedNotebooks =
    incomingNotebooks && incomingNotebooks.length > 0 ? incomingNotebooks : current.notebooks

  const fallbackBucket = getUserFallbackBucket(userKey)
  fallbackBucket.threads.clear()
  for (const t of mergedThreads) {
    fallbackBucket.threads.set(t.id, t)
  }
  fallbackBucket.notebooks = mergedNotebooks

  await Promise.all([
    writeUserStoreToPostgres(userKey, mergedThreads, mergedNotebooks),
    upsertThreadsInPrisma(userKey, resolvedIncomingThreads, incomingNotebooks),
  ])

  return NextResponse.json(
    {
      ok: true,
      userKey,
      thread: resolvedIncomingThreads[0] ?? null,
      count: mergedThreads.length,
      timestamp: new Date().toISOString(),
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

export async function DELETE(request: NextRequest) {
  const guard = await requireExecApiSession(request, { allowAuditor: false })
  if (!guard.ok) return guard.response

  if (guard.session.role === 'auditor') {
    return NextResponse.json(
      {
        ok: false,
        error: 'Read-only auditor session',
        errorAr: 'حساب مراجعة للقراءة فقط — حذف المحادثات غير متاح.',
      },
      { status: 403, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const userKey = resolveSessionUserKey(guard.session)
  if (!userKey) {
    return NextResponse.json(
      { ok: false, error: 'Authentication required' },
      { status: 401, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  let targetId = request.nextUrl.searchParams.get('id')?.trim() ?? ''
  if (!targetId) {
    try {
      const body = asRecord(await request.json())
      if (typeof body?.id === 'string') {
        targetId = body.id.trim()
      }
    } catch {
      // query string id check handles missing body
    }
  }

  if (!targetId) {
    return NextResponse.json(
      { ok: false, error: 'THREAD_ID_REQUIRED' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }

  const current = await loadUserThreads(userKey)
  const remaining = current.threads.filter((t) => t.id !== targetId)

  const fallbackBucket = getUserFallbackBucket(userKey)
  fallbackBucket.threads.delete(targetId)

  await Promise.all([
    writeUserStoreToPostgres(userKey, remaining, current.notebooks),
    deleteThreadInPrisma(userKey, targetId),
  ])

  return NextResponse.json(
    {
      ok: true,
      userKey,
      deletedId: targetId,
      count: remaining.length,
      timestamp: new Date().toISOString(),
    },
    { headers: ENTERPRISE_API_SECURITY_HEADERS },
  )
}

async function methodNotAllowed(request: NextRequest) {
  const guard = await requireExecApiSession(request, { allowAuditor: false })
  if (!guard.ok) return guard.response
  return NextResponse.json(
    { ok: false, error: 'Method not allowed' },
    {
      status: 405,
      headers: {
        ...ENTERPRISE_API_SECURITY_HEADERS,
        Allow: 'GET, POST, DELETE',
      },
    },
  )
}

export function PUT(request: NextRequest) {
  return methodNotAllowed(request)
}

export function PATCH(request: NextRequest) {
  return methodNotAllowed(request)
}
