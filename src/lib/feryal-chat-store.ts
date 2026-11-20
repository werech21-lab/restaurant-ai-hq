/**
 * Persistent DB-Backed Chat History & Topic Notebooks Store
 * (`src/lib/feryal-chat-store.ts`)
 *
 * - Authenticated server-side DB persistence via `/api/erp/feryal/threads` (scoped strictly per user)
 * - Instant synchronous `localStorage` index & recent-threads mirror (`aether_feryal_chats_index_v2`)
 * - Full client IndexedDB mirror (`aether_feryal_chats_v2`)
 * - Smart 4-to-6 word auto-titling (ZERO `Untitled`) + chronological Asia/Kuwait grouping
 */

import {
  FERYAL_LEARNING_MIRROR_KEY,
  getFeryalMemorySync,
  hydrateFeryalMemory,
  type FeryalMemoryState,
} from '@/lib/feryal-learning-engine'
import type { StoredAttachmentMeta, VisionComplianceTier } from '@/lib/feryal-multimodal'
import { formatDate } from '@/lib/format'

export const FERYAL_CHATS_DB_NAME = 'aether_feryal_chats_v2'
export const FERYAL_CHATS_INDEX_KEY = 'aether_feryal_chats_index_v2'
export const FERYAL_THREADS_MIRROR_KEY = 'aether_feryal_threads_mirror_v2'
export const FERYAL_ACTIVE_USER_KEY = 'aether_feryal_active_user_v2'
export const FERYAL_NOTEBOOKS_KEY = 'aether_feryal_notebooks_v2'
export const FERYAL_CHATS_MIGRATED_KEY = 'aether_feryal_chats_migrated_v2'
export const FERYAL_CHATS_UPDATED_EVENT = 'aether-feryal-chats-updated'

export interface StoredExecutedQueryMeta {
  model: string
  method: string
  domain: unknown[]
  groupby: string[]
  period: { from: string; to: string }
}

export interface StoredVerifierMeta {
  valid: boolean
  extractedNumbers: number[]
  unverifiedNumbers: number[]
  reason?: string
}

export interface StoredCouncilChipMeta {
  provider: string
  modelId: string
  status: string
  errorCode?: string | null
  offendingNumbers?: string[]
}

export interface StoredCouncilAgreementMeta {
  provider: string
  modelId: string
}

export interface StoredChatMessage {
  id: string
  sender: 'user' | 'feryal'
  text: string
  time: string
  attachmentsMeta?: StoredAttachmentMeta[]
  visionCompliance?: VisionComplianceTier
  hasVisualEvidence?: boolean
  engineLabelAr?: string
  engineLabelEn?: string
  claudeReply?: string
  claudeModel?: string
  claudeThinkingSummary?: string
  geminiReply?: string
  geminiModel?: string
  grokReply?: string
  grokModel?: string
  statusNoteAr?: string
  statusNoteEn?: string
  userPrompt?: string
  replyStatus?: string
  contradictoryActions?: boolean
  executedQueries?: StoredExecutedQueryMeta[]
  verifier?: StoredVerifierMeta
  council?: StoredCouncilChipMeta[]
  agreed?: StoredCouncilAgreementMeta[]
}

export interface FeryalNotebook {
  id: string
  nameAr: string
  nameEn: string
  icon: string
  isDefault?: boolean
  createdAt: string
}

export interface FeryalChatSummary {
  id: string
  title: string
  notebookId: string
  pinned: boolean
  lang: 'ar' | 'en'
  messageCount: number
  previewText: string
  searchableCorpus: string
  filterLabel?: string
  createdAt: string
  updatedAt: string
}

export interface FeryalChatThread extends FeryalChatSummary {
  messages: StoredChatMessage[]
}

export type ChronologicalGroupId = 'pinned' | 'today' | 'yesterday' | 'this_week' | 'older'

export interface ChronologicalChatGroup {
  id: ChronologicalGroupId
  labelAr: string
  labelEn: string
  chats: FeryalChatSummary[]
}

export const DEFAULT_NOTEBOOKS: readonly FeryalNotebook[] = [
  {
    id: 'nb-buying-ardiya',
    nameAr: 'المشتريات ومطبخ العارضية',
    nameEn: 'Buying & Ardiya Kitchen',
    icon: '🏭',
    isDefault: true,
    createdAt: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 'nb-delivery-fees',
    nameAr: 'تطبيقات التوصيل والعمولات',
    nameEn: 'Delivery Apps & Fees',
    icon: '🛵',
    isDefault: true,
    createdAt: '2026-01-01T08:01:00.000Z',
  },
  {
    id: 'nb-marketing-influencers',
    nameAr: 'التسويق والمشاهير',
    nameEn: 'Marketing & Influencers',
    icon: '📣',
    isDefault: true,
    createdAt: '2026-01-01T08:02:00.000Z',
  },
  {
    id: 'nb-branches-pricing',
    nameAr: 'قرارات الفروع والأسعار',
    nameEn: 'Branches & Pricing',
    icon: '🏷️',
    isDefault: true,
    createdAt: '2026-01-01T08:03:00.000Z',
  },
] as const

const ARABIC_LEAD_FILLERS = new Set([
  'السلام',
  'عليكم',
  'هلا',
  'اهلا',
  'أهلا',
  'مرحبا',
  'يا',
  'فريال',
  'لو',
  'سمحت',
  'سمحتي',
  'ممكن',
  'عطني',
  'اعطني',
  'أعطني',
  'شنو',
  'شنهو',
  'وش',
  'ماذا',
  'ابي',
  'أبي',
  'ابغى',
  'أريد',
  'اريد',
  'قولي',
  'علميني',
  'اشرحي',
  'لي',
  'بسرعة',
  'الحين',
  'الآن',
])

const EN_LEAD_FILLERS = new Set([
  'hi',
  'hello',
  'hey',
  'feryal',
  'ferial',
  'please',
  'can',
  'could',
  'you',
  'give',
  'me',
  'tell',
  'what',
  'is',
  'are',
  'the',
  'show',
])

export function generateSmartChatTitle(
  rawFirstPrompt: string,
  lang: 'ar' | 'en' = 'ar',
  filterSubtitle?: string,
): string {
  const cleaned = (rawFirstPrompt || '')
    .replace(/\[.*?\]/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[🚀🔥🔬⚡🧠📦🏭🛵✅📌📋🔍؟?!.,،؛:"'()\-–—/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (lang === 'ar') {
    const tokens = cleaned.split(' ').filter(Boolean)
    while (tokens.length > 0 && ARABIC_LEAD_FILLERS.has(tokens[0])) {
      tokens.shift()
    }
    const core = tokens.slice(0, 6)
    if (core.length >= 4) {
      return core.join(' ')
    }
    if (core.length > 0) {
      const suffix = filterSubtitle
        ? filterSubtitle.split('•')[0]?.trim() || 'فروع فنتشر فودز'
        : 'أرقام فنتشر فودز'
      const combined = [...core, 'في', ...suffix.split(/\s+/)]
        .filter(Boolean)
        .slice(0, 6)
      return combined.length >= 4 ? combined.join(' ') : `${core.join(' ')} في فروع الشركة`
    }
    return 'مراجعة أرقام وربحية فروع الشركة'
  }

  const enTokens = cleaned.split(' ').filter(Boolean)
  while (enTokens.length > 0 && EN_LEAD_FILLERS.has(enTokens[0].toLowerCase())) {
    enTokens.shift()
  }
  const enCore = enTokens.slice(0, 6)
  if (enCore.length >= 4) return enCore.join(' ')
  if (enCore.length > 0) {
    return `${enCore.join(' ')} Across Active Branches`.split(/\s+/).slice(0, 6).join(' ')
  }
  return 'Venture Foods Branch Profit Review'
}

export function inferNotebookId(text: string): string {
  const t = (text || '').toLowerCase()
  if (
    /مشتريات|مورد|موردين|مخزن|العارضية|عارضية|وصفة|وزن|تالف|هدر|بروتين|تغليف|supplier|warehouse|ardiya|recipe|portion|waste/i.test(
      t,
    )
  ) {
    return 'nb-buying-ardiya'
  }
  if (
    /توصيل|طلبات|كيتا|ديليفرو|جاهز|عمولة|عمولات|سائق|سائقي|tmp|tgo|talabat|keeta|deliveroo|aggregator|driver/i.test(
      t,
    )
  ) {
    return 'nb-delivery-fees'
  }
  if (
    /تسويق|مشاهير|اعلان|إعلان|انستقرام|سناب|تيك|عروض|فعالية|معرض|بوث|marketing|influencer|promo|event|exb/i.test(
      t,
    )
  ) {
    return 'nb-marketing-influencers'
  }
  return 'nb-branches-pricing'
}

let indexMemoryCache: FeryalChatSummary[] | null = null
let notebooksMemoryCache: FeryalNotebook[] | null = null
const threadMemoryCache = new Map<string, FeryalChatThread>()

function emitUpdate(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(FERYAL_CHATS_UPDATED_EVENT))
  } catch {
    // ignore dispatch error
  }
}

function openChatsIdb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(FERYAL_CHATS_DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('threads')) {
          const store = db.createObjectStore('threads', { keyPath: 'id' })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
          store.createIndex('notebookId', 'notebookId', { unique: false })
        }
        if (!db.objectStoreNames.contains('notebooks')) {
          db.createObjectStore('notebooks', { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbPutThread(thread: FeryalChatThread): Promise<void> {
  const db = await openChatsIdb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('threads', 'readwrite')
      tx.objectStore('threads').put(thread)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function idbDeleteThread(chatId: string): Promise<void> {
  const db = await openChatsIdb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('threads', 'readwrite')
      tx.objectStore('threads').delete(chatId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function idbClearAllThreads(): Promise<void> {
  const db = await openChatsIdb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction('threads', 'readwrite')
      tx.objectStore('threads').clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

async function idbGetThread(chatId: string): Promise<FeryalChatThread | null> {
  const db = await openChatsIdb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('threads', 'readonly')
      const req = tx.objectStore('threads').get(chatId)
      req.onsuccess = () => resolve((req.result as FeryalChatThread | undefined) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function idbGetAllThreads(): Promise<FeryalChatThread[]> {
  const db = await openChatsIdb()
  if (!db) return []
  return new Promise((resolve) => {
    try {
      const tx = db.transaction('threads', 'readonly')
      const req = tx.objectStore('threads').getAll()
      req.onsuccess = () => resolve((req.result as FeryalChatThread[]) ?? [])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

function readThreadsMirrorFromStorage(): FeryalChatThread[] {
  if (typeof window === 'undefined' || !window.localStorage) return []
  try {
    const raw = window.localStorage.getItem(FERYAL_THREADS_MIRROR_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is FeryalChatThread =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as FeryalChatThread).id === 'string' &&
        Array.isArray((item as FeryalChatThread).messages),
    )
  } catch {
    return []
  }
}

function saveThreadsMirrorToStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const sorted = Array.from(threadMemoryCache.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 30)
    window.localStorage.setItem(FERYAL_THREADS_MIRROR_KEY, JSON.stringify(sorted))
  } catch {
    // If localStorage quota is tight due to thumbnails, persist without large data URLs
    try {
      const compact = Array.from(threadMemoryCache.values())
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 20)
        .map((t) => ({
          ...t,
          messages: t.messages.map((m) => ({
            ...m,
            attachmentsMeta: m.attachmentsMeta?.map((att) => ({
              ...att,
              thumbDataUrl: '',
              frameThumbs: undefined,
            })),
          })),
        }))
      window.localStorage.setItem(FERYAL_THREADS_MIRROR_KEY, JSON.stringify(compact))
    } catch {
      // IndexedDB and server DB still hold the full thread
    }
  }
}

function saveIndexMirror(list: FeryalChatSummary[]): void {
  const sorted = [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  indexMemoryCache = sorted
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FERYAL_CHATS_INDEX_KEY, JSON.stringify(sorted))
    } catch {
      // ignore storage error
    }
  }
  saveThreadsMirrorToStorage()
  emitUpdate()
}

async function pushThreadToServer(
  thread: FeryalChatThread,
  notebooks?: FeryalNotebook[],
): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return false
  try {
    const res = await fetch('/api/erp/feryal/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        thread,
        ...(notebooks ? { notebooks } : {}),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function pushNotebooksToServer(notebooks: FeryalNotebook[]): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return
  try {
    await fetch('/api/erp/feryal/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notebooks }),
    })
  } catch {
    // ignore offline sync error
  }
}

async function deleteThreadFromServer(chatId: string): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return
  try {
    await fetch(`/api/erp/feryal/threads?id=${encodeURIComponent(chatId)}`, {
      method: 'DELETE',
    })
  } catch {
    // ignore offline delete error
  }
}

function saveNotebooksMirror(list: FeryalNotebook[], syncRemote = true): void {
  notebooksMemoryCache = list
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FERYAL_NOTEBOOKS_KEY, JSON.stringify(list))
    } catch {
      // ignore storage error
    }
  }
  void (async () => {
    const db = await openChatsIdb()
    if (!db) return
    try {
      const tx = db.transaction('notebooks', 'readwrite')
      const store = tx.objectStore('notebooks')
      store.clear()
      for (const nb of list) store.put(nb)
    } catch {
      // ignore idb error
    }
  })()
  if (syncRemote) {
    void pushNotebooksToServer(list)
  }
  emitUpdate()
}

export function getNotebooksSync(): FeryalNotebook[] {
  if (notebooksMemoryCache) return notebooksMemoryCache
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(FERYAL_NOTEBOOKS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FeryalNotebook[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          notebooksMemoryCache = parsed
          return parsed
        }
      }
    } catch {
      // ignore storage error
    }
  }
  notebooksMemoryCache = [...DEFAULT_NOTEBOOKS]
  return notebooksMemoryCache
}

export function getChatIndexSync(): FeryalChatSummary[] {
  if (indexMemoryCache) return indexMemoryCache
  if (typeof window !== 'undefined' && window.localStorage) {
    for (const t of readThreadsMirrorFromStorage()) {
      if (!threadMemoryCache.has(t.id)) {
        threadMemoryCache.set(t.id, t)
      }
    }
    try {
      const raw = window.localStorage.getItem(FERYAL_CHATS_INDEX_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FeryalChatSummary[]
        if (Array.isArray(parsed)) {
          indexMemoryCache = parsed
          return parsed
        }
      }
    } catch {
      // ignore storage error
    }
  }
  indexMemoryCache = []
  return indexMemoryCache
}

function toSummary(thread: FeryalChatThread): FeryalChatSummary {
  const { messages: _m, ...summary } = thread
  return summary
}

async function migrateLegacySavedChats(): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (window.localStorage.getItem(FERYAL_CHATS_MIGRATED_KEY) === '1') return

  const legacyKeys = [
    'feryal_chats',
    'aether_feryal_chats',
    'aether_feryal_chats_v1',
    'aetherbi_feryal_history',
    'vf_feryal_chats_v1',
  ]

  for (const key of legacyKeys) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) continue
      for (const rawItem of parsed) {
        if (!rawItem || typeof rawItem !== 'object') continue
        const item = rawItem as Record<string, unknown>
        if (!Array.isArray(item.messages) || item.messages.length === 0) continue
        const firstUser = item.messages.find((m) => {
          if (!m || typeof m !== 'object') return false
          const rec = m as { sender?: string; role?: string }
          return rec.sender === 'user' || rec.role === 'user'
        }) as { text?: string; content?: string } | undefined
        const rawTitle = String(item.title || '').trim()
        const validTitle =
          rawTitle && !/untitled|بدون عنوان/i.test(rawTitle)
            ? rawTitle
            : generateSmartChatTitle(firstUser?.text || firstUser?.content || '', 'ar')

        const normalizedMsgs: StoredChatMessage[] = item.messages
          .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
          .map((m, idx) => ({
            id: String(m.id || `migrated-${idx}`),
            sender: m.sender === 'user' || m.role === 'user' ? 'user' : 'feryal',
            text: String(m.text || m.content || ''),
            time: String(m.time || ''),
          }))

        const corpus = normalizedMsgs
          .map((m) => m.text)
          .join(' ')
          .slice(0, 4000)
        const id = String(item.id || `legacy-${Date.now()}-${threadMemoryCache.size + 1}`)
        const thread: FeryalChatThread = {
          id,
          title: validTitle,
          notebookId: inferNotebookId(corpus),
          pinned: Boolean(item.pinned),
          lang: item.lang === 'en' ? 'en' : 'ar',
          messageCount: normalizedMsgs.length,
          previewText: normalizedMsgs[normalizedMsgs.length - 1]?.text.slice(0, 120) || '',
          searchableCorpus: corpus,
          createdAt: String(item.createdAt || new Date().toISOString()),
          updatedAt: String(item.updatedAt || new Date().toISOString()),
          messages: normalizedMsgs,
        }
        threadMemoryCache.set(id, thread)
        await idbPutThread(thread)
      }
    } catch {
      // skip invalid legacy payload
    }
  }

  try {
    window.localStorage.setItem(FERYAL_CHATS_MIGRATED_KEY, '1')
  } catch {
    // ignore storage error
  }
}

export async function syncThreadsFromServer(): Promise<{
  chats: FeryalChatSummary[]
  notebooks: FeryalNotebook[]
}> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    return { chats: getChatIndexSync(), notebooks: getNotebooksSync() }
  }

  try {
    const res = await fetch('/api/erp/feryal/threads', {
      method: 'GET',
      cache: 'no-store',
    })
    if (!res.ok) {
      return { chats: getChatIndexSync(), notebooks: getNotebooksSync() }
    }
    const data = (await res.json()) as {
      ok?: boolean
      userKey?: string
      threads?: FeryalChatThread[]
      notebooks?: FeryalNotebook[]
    }
    if (!data?.ok || !Array.isArray(data.threads)) {
      return { chats: getChatIndexSync(), notebooks: getNotebooksSync() }
    }

    const previousUserKey = window.localStorage?.getItem(FERYAL_ACTIVE_USER_KEY) ?? null
    const activeUserKey = typeof data.userKey === 'string' ? data.userKey : null
    const switchedUser = Boolean(
      activeUserKey && previousUserKey && previousUserKey !== activeUserKey,
    )

    if (activeUserKey && window.localStorage) {
      try {
        window.localStorage.setItem(FERYAL_ACTIVE_USER_KEY, activeUserKey)
      } catch {
        // ignore storage error
      }
    }

    if (switchedUser) {
      threadMemoryCache.clear()
      indexMemoryCache = []
      await idbClearAllThreads()
    }

    const mergedThreadsMap = new Map<string, FeryalChatThread>()
    if (!switchedUser) {
      for (const localThread of threadMemoryCache.values()) {
        mergedThreadsMap.set(localThread.id, localThread)
      }
    }

    const serverIds = new Set<string>()
    for (const remoteThread of data.threads) {
      if (!remoteThread?.id || !Array.isArray(remoteThread.messages)) continue
      serverIds.add(remoteThread.id)
      const local = mergedThreadsMap.get(remoteThread.id)
      if (!local) {
        mergedThreadsMap.set(remoteThread.id, remoteThread)
      } else {
        const remoteTs = new Date(remoteThread.updatedAt).getTime()
        const localTs = new Date(local.updatedAt).getTime()
        if (
          remoteTs >= localTs ||
          remoteThread.messages.length >= local.messages.length
        ) {
          mergedThreadsMap.set(remoteThread.id, remoteThread)
        }
      }
    }

    const summaries: FeryalChatSummary[] = []
    const unsyncedLocal: FeryalChatThread[] = []
    for (const thread of mergedThreadsMap.values()) {
      if (!thread.title || /untitled|بدون عنوان/i.test(thread.title)) {
        const firstUser = thread.messages.find((m) => m.sender === 'user')
        thread.title = generateSmartChatTitle(firstUser?.text || '', thread.lang)
      }
      threadMemoryCache.set(thread.id, thread)
      summaries.push(toSummary(thread))
      void idbPutThread(thread)
      if (!switchedUser && !serverIds.has(thread.id)) {
        unsyncedLocal.push(thread)
      }
    }

    if (Array.isArray(data.notebooks) && data.notebooks.length > 0) {
      const nbMap = new Map<string, FeryalNotebook>()
      for (const def of DEFAULT_NOTEBOOKS) nbMap.set(def.id, def)
      for (const nb of data.notebooks) {
        if (nb?.id && nb?.nameAr) nbMap.set(nb.id, nb)
      }
      saveNotebooksMirror(Array.from(nbMap.values()), false)
    }

    saveIndexMirror(summaries)

    if (unsyncedLocal.length > 0) {
      void fetch('/api/erp/feryal/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads: unsyncedLocal.slice(0, 25) }),
      }).catch(() => undefined)
    }
  } catch {
    // Offline or test environment without server route mounted
  }

  return { chats: getChatIndexSync(), notebooks: getNotebooksSync() }
}

export async function hydrateFeryalChatStore(): Promise<{
  chats: FeryalChatSummary[]
  notebooks: FeryalNotebook[]
}> {
  await migrateLegacySavedChats()

  for (const mirrored of readThreadsMirrorFromStorage()) {
    threadMemoryCache.set(mirrored.id, mirrored)
  }

  const allThreads = await idbGetAllThreads()
  if (allThreads.length > 0) {
    for (const t of allThreads) {
      if (!t.title || /untitled|بدون عنوان/i.test(t.title)) {
        const firstUser = t.messages?.find((m) => m.sender === 'user')
        t.title = generateSmartChatTitle(firstUser?.text || '', t.lang)
      }
      const existing = threadMemoryCache.get(t.id)
      if (
        !existing ||
        new Date(t.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()
      ) {
        threadMemoryCache.set(t.id, t)
      }
    }
  }

  if (threadMemoryCache.size > 0) {
    saveIndexMirror(Array.from(threadMemoryCache.values()).map(toSummary))
  } else {
    getChatIndexSync()
  }

  return syncThreadsFromServer()
}

export async function loadChatThread(chatId: string): Promise<FeryalChatThread | null> {
  const cached = threadMemoryCache.get(chatId)
  if (cached && cached.messages.length > 0) return cached

  const fromStorage = readThreadsMirrorFromStorage().find((t) => t.id === chatId)
  if (fromStorage && fromStorage.messages.length > 0) {
    threadMemoryCache.set(chatId, fromStorage)
    return fromStorage
  }

  const fromIdb = await idbGetThread(chatId)
  if (fromIdb && fromIdb.messages.length > 0) {
    threadMemoryCache.set(chatId, fromIdb)
    return fromIdb
  }

  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    try {
      const res = await fetch(`/api/erp/feryal/threads?id=${encodeURIComponent(chatId)}`, {
        method: 'GET',
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as { ok?: boolean; thread?: FeryalChatThread | null }
        if (data?.ok && data.thread && Array.isArray(data.thread.messages)) {
          threadMemoryCache.set(chatId, data.thread)
          void idbPutThread(data.thread)
          saveThreadsMirrorToStorage()
          return data.thread
        }
      }
    } catch {
      // ignore network error
    }
  }

  return cached ?? fromIdb ?? null
}

export async function autoSaveChatThread({
  chatId,
  messages,
  lang,
  filterLabel,
  preferredNotebookId,
}: {
  chatId: string
  messages: StoredChatMessage[]
  lang: 'ar' | 'en'
  filterLabel?: string
  preferredNotebookId?: string | null
}): Promise<FeryalChatSummary | null> {
  const userMessages = messages.filter(
    (m) =>
      m.sender === 'user' &&
      (m.text.trim().length > 0 || (m.attachmentsMeta && m.attachmentsMeta.length > 0)),
  )
  if (userMessages.length === 0) return null

  const existingSummary = getChatIndexSync().find((c) => c.id === chatId)
  const existingThread = threadMemoryCache.get(chatId)
  const nowIso = new Date().toISOString()

  const firstUserText = userMessages[0].text
  const title =
    existingSummary?.title && !/untitled|بدون عنوان/i.test(existingSummary.title)
      ? existingSummary.title
      : generateSmartChatTitle(firstUserText, lang, filterLabel)

  const notebookId =
    existingSummary?.notebookId ||
    (preferredNotebookId && preferredNotebookId !== 'all' ? preferredNotebookId : '') ||
    inferNotebookId(firstUserText)

  const lastMsg = messages[messages.length - 1]
  const corpus = messages
    .filter((m) => m.id !== 'welcome')
    .map((m) => m.text)
    .join(' ')
    .slice(0, 6000)

  const thread: FeryalChatThread = {
    id: chatId,
    title,
    notebookId,
    pinned: existingSummary?.pinned ?? false,
    lang,
    messageCount: messages.filter((m) => m.id !== 'welcome').length,
    previewText: (lastMsg?.text || '').replace(/[#*`]/g, '').trim().slice(0, 120),
    searchableCorpus: corpus,
    filterLabel: filterLabel || existingSummary?.filterLabel,
    createdAt: existingSummary?.createdAt || existingThread?.createdAt || nowIso,
    updatedAt: nowIso,
    messages,
  }

  threadMemoryCache.set(chatId, thread)
  const summary = toSummary(thread)
  const others = getChatIndexSync().filter((c) => c.id !== chatId)
  saveIndexMirror([summary, ...others])
  await Promise.all([idbPutThread(thread), pushThreadToServer(thread)])
  return summary
}

export async function togglePinChat(chatId: string): Promise<void> {
  const list = getChatIndexSync()
  const idx = list.findIndex((c) => c.id === chatId)
  if (idx === -1) return
  const updated = { ...list[idx], pinned: !list[idx].pinned, updatedAt: new Date().toISOString() }
  const next = [...list]
  next[idx] = updated
  saveIndexMirror(next)

  const thread = await loadChatThread(chatId)
  if (thread) {
    const nextThread = { ...thread, pinned: updated.pinned, updatedAt: updated.updatedAt }
    threadMemoryCache.set(chatId, nextThread)
    await Promise.all([idbPutThread(nextThread), pushThreadToServer(nextThread)])
  }
}

export async function renameChat(chatId: string, newTitle: string): Promise<void> {
  const clean = newTitle.trim()
  if (!clean) return
  const list = getChatIndexSync()
  const idx = list.findIndex((c) => c.id === chatId)
  if (idx === -1) return
  const updated = { ...list[idx], title: clean, updatedAt: new Date().toISOString() }
  const next = [...list]
  next[idx] = updated
  saveIndexMirror(next)

  const thread = await loadChatThread(chatId)
  if (thread) {
    const nextThread = { ...thread, title: clean, updatedAt: updated.updatedAt }
    threadMemoryCache.set(chatId, nextThread)
    await Promise.all([idbPutThread(nextThread), pushThreadToServer(nextThread)])
  }
}

export async function moveChatToNotebook(chatId: string, notebookId: string): Promise<void> {
  const list = getChatIndexSync()
  const idx = list.findIndex((c) => c.id === chatId)
  if (idx === -1) return
  const updated = { ...list[idx], notebookId, updatedAt: new Date().toISOString() }
  const next = [...list]
  next[idx] = updated
  saveIndexMirror(next)

  const thread = await loadChatThread(chatId)
  if (thread) {
    const nextThread = { ...thread, notebookId, updatedAt: updated.updatedAt }
    threadMemoryCache.set(chatId, nextThread)
    await Promise.all([idbPutThread(nextThread), pushThreadToServer(nextThread)])
  }
}

export async function deleteChat(chatId: string): Promise<void> {
  threadMemoryCache.delete(chatId)
  const next = getChatIndexSync().filter((c) => c.id !== chatId)
  saveIndexMirror(next)
  await Promise.all([idbDeleteThread(chatId), deleteThreadFromServer(chatId)])
}

export function createNotebook(nameAr: string, nameEn?: string, icon = '📁'): FeryalNotebook | null {
  const cleanAr = nameAr.trim()
  if (!cleanAr) return null
  const current = getNotebooksSync()
  const nb: FeryalNotebook = {
    id: `nb-${Date.now()}-${current.length + 1}`,
    nameAr: cleanAr,
    nameEn: (nameEn || cleanAr).trim(),
    icon,
    isDefault: false,
    createdAt: new Date().toISOString(),
  }
  saveNotebooksMirror([...current, nb])
  return nb
}

export function renameNotebook(notebookId: string, newName: string): void {
  const clean = newName.trim()
  if (!clean) return
  const next = getNotebooksSync().map((nb) =>
    nb.id === notebookId ? { ...nb, nameAr: clean, nameEn: clean } : nb,
  )
  saveNotebooksMirror(next)
}

export function deleteNotebook(notebookId: string): void {
  const remaining = getNotebooksSync().filter((nb) => nb.id !== notebookId)
  const fallbackId = remaining[0]?.id || 'nb-branches-pricing'
  saveNotebooksMirror(remaining.length > 0 ? remaining : [...DEFAULT_NOTEBOOKS])

  const chats = getChatIndexSync()
  let touched = false
  const updatedChats = chats.map((c) => {
    if (c.notebookId === notebookId) {
      touched = true
      return { ...c, notebookId: fallbackId }
    }
    return c
  })
  if (touched) saveIndexMirror(updatedChats)
}

export function filterAndGroupChats({
  chats,
  notebooks,
  activeNotebookId,
  searchQuery,
}: {
  chats: FeryalChatSummary[]
  notebooks: FeryalNotebook[]
  activeNotebookId: string
  searchQuery: string
}): ChronologicalChatGroup[] {
  const q = searchQuery.trim().toLowerCase()
  const nbMap = new Map(notebooks.map((n) => [n.id, n]))

  const filtered = chats.filter((c) => {
    if (activeNotebookId !== 'all' && c.notebookId !== activeNotebookId) return false
    if (!q) return true
    const nb = nbMap.get(c.notebookId)
    const hay = [
      c.title,
      c.previewText,
      c.searchableCorpus,
      c.filterLabel || '',
      nb?.nameAr || '',
      nb?.nameEn || '',
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  const kwTodayIso = formatDate(new Date(), 'en')
  const startOfToday = new Date(`${kwTodayIso}T00:00:00+03:00`).getTime()
  const startOfYesterday = startOfToday - 86_400_000
  const startOfWeek = startOfToday - 6 * 86_400_000

  const buckets: Record<ChronologicalGroupId, FeryalChatSummary[]> = {
    pinned: [],
    today: [],
    yesterday: [],
    this_week: [],
    older: [],
  }

  for (const chat of filtered) {
    if (chat.pinned) {
      buckets.pinned.push(chat)
      continue
    }
    const ts = new Date(chat.updatedAt).getTime()
    if (ts >= startOfToday) buckets.today.push(chat)
    else if (ts >= startOfYesterday) buckets.yesterday.push(chat)
    else if (ts >= startOfWeek) buckets.this_week.push(chat)
    else buckets.older.push(chat)
  }

  const definitions: Array<{ id: ChronologicalGroupId; labelAr: string; labelEn: string }> = [
    { id: 'pinned', labelAr: 'المثبّتة 📌', labelEn: 'Pinned 📌' },
    { id: 'today', labelAr: 'اليوم', labelEn: 'Today' },
    { id: 'yesterday', labelAr: 'أمس', labelEn: 'Yesterday' },
    { id: 'this_week', labelAr: 'هذا الأسبوع', labelEn: 'This Week' },
    { id: 'older', labelAr: 'السابق', labelEn: 'Older' },
  ]

  return definitions
    .map((d) => ({
      ...d,
      chats: buckets[d.id],
    }))
    .filter((g) => g.chats.length > 0)
}

export interface FeryalBackupBundle {
  schema: 'aether_feryal_backup_v2'
  exportedAt: string
  notebooks: FeryalNotebook[]
  threads: FeryalChatThread[]
  memory: FeryalMemoryState
}

export async function exportFeryalWorkspaceJson(): Promise<string> {
  const threads = await idbGetAllThreads()
  const byId = new Map<string, FeryalChatThread>()
  for (const t of threads) byId.set(t.id, t)
  for (const [id, t] of threadMemoryCache.entries()) {
    if (!byId.has(id)) byId.set(id, t)
  }

  const bundle: FeryalBackupBundle = {
    schema: 'aether_feryal_backup_v2',
    exportedAt: new Date().toISOString(),
    notebooks: getNotebooksSync(),
    threads: Array.from(byId.values()),
    memory: getFeryalMemorySync(),
  }
  return JSON.stringify(bundle, null, 2)
}

export async function importFeryalWorkspaceJson(rawJson: string): Promise<{
  restoredChats: number
  restoredNotebooks: number
}> {
  const parsed = JSON.parse(rawJson) as Partial<FeryalBackupBundle>
  let restoredNotebooks = 0
  let restoredChats = 0

  if (Array.isArray(parsed.notebooks) && parsed.notebooks.length > 0) {
    const existing = getNotebooksSync()
    const mergedMap = new Map<string, FeryalNotebook>()
    for (const nb of existing) mergedMap.set(nb.id, nb)
    for (const nb of parsed.notebooks) {
      if (nb?.id && nb?.nameAr) {
        mergedMap.set(nb.id, nb)
        restoredNotebooks++
      }
    }
    saveNotebooksMirror(Array.from(mergedMap.values()))
  }

  if (Array.isArray(parsed.threads)) {
    const summariesMap = new Map<string, FeryalChatSummary>()
    for (const s of getChatIndexSync()) summariesMap.set(s.id, s)
    const syncedBatch: FeryalChatThread[] = []

    for (const t of parsed.threads) {
      if (!t?.id || !Array.isArray(t.messages)) continue
      const safeTitle =
        t.title && !/untitled|بدون عنوان/i.test(t.title)
          ? t.title
          : generateSmartChatTitle(
              t.messages.find((m) => m.sender === 'user')?.text || '',
              t.lang || 'ar',
            )
      const normalized: FeryalChatThread = {
        ...t,
        title: safeTitle,
        notebookId: t.notebookId || inferNotebookId(safeTitle),
      }
      threadMemoryCache.set(normalized.id, normalized)
      summariesMap.set(normalized.id, toSummary(normalized))
      syncedBatch.push(normalized)
      await idbPutThread(normalized)
      restoredChats++
    }
    saveIndexMirror(Array.from(summariesMap.values()))

    if (syncedBatch.length > 0 && typeof window !== 'undefined' && typeof fetch === 'function') {
      void fetch('/api/erp/feryal/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threads: syncedBatch.slice(0, 50) }),
      }).catch(() => undefined)
    }
  }

  if (parsed.memory && Array.isArray(parsed.memory.rules) && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(FERYAL_LEARNING_MIRROR_KEY, JSON.stringify(parsed.memory))
      await hydrateFeryalMemory()
    } catch {
      // ignore memory import error
    }
  }

  return { restoredChats, restoredNotebooks }
}
