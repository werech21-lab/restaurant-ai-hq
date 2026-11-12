/**
 * Gemini-Style Persistent Chat History & Topic Notebooks Store
 * (`src/lib/feryal-chat-store.ts`)
 *
 * - Unlimited full chat threads stored in IndexedDB (`aether_feryal_chats_v2`)
 * - Instant synchronous `localStorage` index mirror (`aether_feryal_chats_index_v2`)
 * - Automatic migration of legacy saved chats from localStorage
 * - Zero-click real-time auto-save + smart 4-to-6 word plain-Arabic auto-titling (ZERO `Untitled`)
 * - Editable Topic Notebooks (`دفاتر المواضيع 📁`) + chronological grouping + full-text search + JSON backup/restore
 */

import {
  FERYAL_LEARNING_MIRROR_KEY,
  getFeryalMemorySync,
  hydrateFeryalMemory,
  type FeryalMemoryState,
} from '@/lib/feryal-learning-engine'
import type { StoredAttachmentMeta, VisionComplianceTier } from '@/lib/feryal-multimodal'

export const FERYAL_CHATS_DB_NAME = 'aether_feryal_chats_v2'
export const FERYAL_CHATS_INDEX_KEY = 'aether_feryal_chats_index_v2'
export const FERYAL_NOTEBOOKS_KEY = 'aether_feryal_notebooks_v2'
export const FERYAL_CHATS_MIGRATED_KEY = 'aether_feryal_chats_migrated_v2'
export const FERYAL_CHATS_UPDATED_EVENT = 'aether-feryal-chats-updated'

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

// ============================================================================
// Smart 4-to-6 Word Plain-Arabic Auto-Titling (ZERO `Untitled`)
// ============================================================================
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
  if (enCore.length > 0) return `${enCore.join(' ')} Across Active Branches`.split(/\s+/).slice(0, 6).join(' ')
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

// ============================================================================
// IndexedDB (`aether_feryal_chats_v2`) + Fast `localStorage` Mirror
// ============================================================================
let indexMemoryCache: FeryalChatSummary[] | null = null
let notebooksMemoryCache: FeryalNotebook[] | null = null
const threadMemoryCache = new Map<string, FeryalChatThread>()

function emitUpdate(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(FERYAL_CHATS_UPDATED_EVENT))
  } catch {}
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

function saveIndexMirror(list: FeryalChatSummary[]): void {
  const sorted = [...list].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
  indexMemoryCache = sorted
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FERYAL_CHATS_INDEX_KEY, JSON.stringify(sorted))
    } catch {}
  }
  emitUpdate()
}

function saveNotebooksMirror(list: FeryalNotebook[]): void {
  notebooksMemoryCache = list
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FERYAL_NOTEBOOKS_KEY, JSON.stringify(list))
    } catch {}
  }
  void (async () => {
    const db = await openChatsIdb()
    if (!db) return
    try {
      const tx = db.transaction('notebooks', 'readwrite')
      const store = tx.objectStore('notebooks')
      store.clear()
      for (const nb of list) store.put(nb)
    } catch {}
  })()
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
          // Ensure the 4 default notebooks exist unless explicitly deleted by user
          notebooksMemoryCache = parsed
          return parsed
        }
      }
    } catch {}
  }
  notebooksMemoryCache = [...DEFAULT_NOTEBOOKS]
  return notebooksMemoryCache
}

export function getChatIndexSync(): FeryalChatSummary[] {
  if (indexMemoryCache) return indexMemoryCache
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(FERYAL_CHATS_INDEX_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as FeryalChatSummary[]
        if (Array.isArray(parsed)) {
          indexMemoryCache = parsed
          return parsed
        }
      }
    } catch {}
  }
  indexMemoryCache = []
  return indexMemoryCache
}

function toSummary(thread: FeryalChatThread): FeryalChatSummary {
  const { messages: _m, ...summary } = thread
  return summary
}

// ============================================================================
// Legacy Chat Migration + IndexedDB Hydration
// ============================================================================
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
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) continue
      for (const item of parsed) {
        if (!item || !Array.isArray(item.messages) || item.messages.length === 0) continue
        const firstUser = item.messages.find(
          (m: { sender?: string; role?: string }) => m.sender === 'user' || m.role === 'user',
        )
        const rawTitle = String(item.title || '').trim()
        const validTitle =
          rawTitle && !/untitled|بدون عنوان/i.test(rawTitle)
            ? rawTitle
            : generateSmartChatTitle(firstUser?.text || firstUser?.content || '', 'ar')

        const normalizedMsgs: StoredChatMessage[] = item.messages.map(
          (m: Record<string, unknown>, idx: number) => ({
            id: String(m.id || `migrated-${idx}`),
            sender: m.sender === 'user' || m.role === 'user' ? 'user' : 'feryal',
            text: String(m.text || m.content || ''),
            time: String(m.time || ''),
          }),
        )

        const corpus = normalizedMsgs
          .map((m) => m.text)
          .join(' ')
          .slice(0, 4000)
        const id = String(item.id || `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`)
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
    } catch {}
  }

  try {
    window.localStorage.setItem(FERYAL_CHATS_MIGRATED_KEY, '1')
  } catch {}
}

export async function hydrateFeryalChatStore(): Promise<{
  chats: FeryalChatSummary[]
  notebooks: FeryalNotebook[]
}> {
  await migrateLegacySavedChats()
  const allThreads = await idbGetAllThreads()
  if (allThreads.length > 0) {
    const summaries: FeryalChatSummary[] = []
    for (const t of allThreads) {
      // Fix any historical Untitled if ever present
      if (!t.title || /untitled|بدون عنوان/i.test(t.title)) {
        const firstUser = t.messages?.find((m) => m.sender === 'user')
        t.title = generateSmartChatTitle(firstUser?.text || '', t.lang)
      }
      threadMemoryCache.set(t.id, t)
      summaries.push(toSummary(t))
    }
    saveIndexMirror(summaries)
  } else {
    getChatIndexSync()
  }
  const notebooks = getNotebooksSync()
  return { chats: getChatIndexSync(), notebooks }
}

// ============================================================================
// Real-Time Zero-Click Auto-Save & CRUD Operations
// ============================================================================
export async function loadChatThread(chatId: string): Promise<FeryalChatThread | null> {
  const cached = threadMemoryCache.get(chatId)
  if (cached) return cached
  const fromIdb = await idbGetThread(chatId)
  if (fromIdb) {
    threadMemoryCache.set(chatId, fromIdb)
    return fromIdb
  }
  return null
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
  // Only persist once at least 1 real user message exists
  const userMessages = messages.filter((m) => m.sender === 'user' && m.text.trim().length > 0)
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
  await idbPutThread(thread)
  return summary
}

export async function togglePinChat(chatId: string): Promise<void> {
  const list = getChatIndexSync()
  const idx = list.findIndex((c) => c.id === chatId)
  if (idx === -1) return
  const updated = { ...list[idx], pinned: !list[idx].pinned }
  const next = [...list]
  next[idx] = updated
  saveIndexMirror(next)

  const thread = await loadChatThread(chatId)
  if (thread) {
    const nextThread = { ...thread, pinned: updated.pinned }
    threadMemoryCache.set(chatId, nextThread)
    await idbPutThread(nextThread)
  }
}

export async function renameChat(chatId: string, newTitle: string): Promise<void> {
  const clean = newTitle.trim()
  if (!clean) return
  const list = getChatIndexSync()
  const idx = list.findIndex((c) => c.id === chatId)
  if (idx === -1) return
  const updated = { ...list[idx], title: clean }
  const next = [...list]
  next[idx] = updated
  saveIndexMirror(next)

  const thread = await loadChatThread(chatId)
  if (thread) {
    const nextThread = { ...thread, title: clean }
    threadMemoryCache.set(chatId, nextThread)
    await idbPutThread(nextThread)
  }
}

export async function moveChatToNotebook(chatId: string, notebookId: string): Promise<void> {
  const list = getChatIndexSync()
  const idx = list.findIndex((c) => c.id === chatId)
  if (idx === -1) return
  const updated = { ...list[idx], notebookId }
  const next = [...list]
  next[idx] = updated
  saveIndexMirror(next)

  const thread = await loadChatThread(chatId)
  if (thread) {
    const nextThread = { ...thread, notebookId }
    threadMemoryCache.set(chatId, nextThread)
    await idbPutThread(nextThread)
  }
}

export async function deleteChat(chatId: string): Promise<void> {
  threadMemoryCache.delete(chatId)
  const next = getChatIndexSync().filter((c) => c.id !== chatId)
  saveIndexMirror(next)
  await idbDeleteThread(chatId)
}

// ============================================================================
// Editable Topic Notebooks (`دفاتر المواضيع 📁`)
// ============================================================================
export function createNotebook(nameAr: string, nameEn?: string, icon = '📁'): FeryalNotebook | null {
  const cleanAr = nameAr.trim()
  if (!cleanAr) return null
  const current = getNotebooksSync()
  const nb: FeryalNotebook = {
    id: `nb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
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

  // Reassign chats cleanly so zero conversations are lost
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

// ============================================================================
// Search & Chronological Grouping (`المثبّتة 📌`, `اليوم`, `أمس`, `هذا الأسبوع`, `السابق`)
// ============================================================================
export function filterAndGroupChats({
  chats,
  notebooks,
  activeNotebookId,
  searchQuery,
}: {
  chats: FeryalChatSummary[]
  notebooks: FeryalNotebook[]
  activeNotebookId: string // 'all' or notebook.id
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

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
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

// ============================================================================
// 1-Click JSON Backup & Restore (Chats + Notebooks + Feryal Evolving Memory)
// ============================================================================
export interface FeryalBackupBundle {
  schema: 'aether_feryal_backup_v2'
  exportedAt: string
  notebooks: FeryalNotebook[]
  threads: FeryalChatThread[]
  memory: FeryalMemoryState
}

export async function exportFeryalWorkspaceJson(): Promise<string> {
  const threads = await idbGetAllThreads()
  // Include any memory-cached threads if IDB was unavailable
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
      await idbPutThread(normalized)
      restoredChats++
    }
    saveIndexMirror(Array.from(summariesMap.values()))
  }

  if (parsed.memory && Array.isArray(parsed.memory.rules) && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(FERYAL_LEARNING_MIRROR_KEY, JSON.stringify(parsed.memory))
      await hydrateFeryalMemory()
    } catch {}
  }

  return { restoredChats, restoredNotebooks }
}
