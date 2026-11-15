import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type AccountLocale = 'ar' | 'en'

type GlobalWithLocaleStore = typeof globalThis & {
  __aetherBiUserLocales?: Map<string, AccountLocale>
}

const g = globalThis as GlobalWithLocaleStore

function getMemoryStore(): Map<string, AccountLocale> {
  if (!g.__aetherBiUserLocales) {
    g.__aetherBiUserLocales = new Map<string, AccountLocale>()
    const initial = readDiskStore()
    for (const [email, loc] of Object.entries(initial)) {
      if (loc === 'ar' || loc === 'en') {
        g.__aetherBiUserLocales.set(email.toLowerCase(), loc)
      }
    }
  }
  return g.__aetherBiUserLocales
}

function candidateStorePaths(): string[] {
  return [
    path.join(process.cwd(), '.runtime', 'user-locales.json'),
    path.join(os.tmpdir(), 'aetherbi-user-locales.json'),
  ]
}

function readDiskStore(): Record<string, AccountLocale> {
  for (const filePath of candidateStorePaths()) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>
        const out: Record<string, AccountLocale> = {}
        for (const [k, v] of Object.entries(parsed)) {
          if (v === 'ar' || v === 'en') {
            out[k.toLowerCase()] = v
          }
        }
        return out
      }
    } catch {
      // Fall through to next candidate path.
    }
  }
  return {}
}

function writeDiskStore(map: Map<string, AccountLocale>): void {
  const serialized = JSON.stringify(Object.fromEntries(map.entries()), null, 2)
  for (const filePath of candidateStorePaths()) {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
      fs.writeFileSync(filePath, serialized, 'utf8')
      return
    } catch {
      // On read-only serverless root, falls through to os.tmpdir().
    }
  }
}

export function getSavedUserLocale(email?: string | null): AccountLocale | null {
  if (!email) return null
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null
  const store = getMemoryStore()
  const mem = store.get(normalized)
  if (mem === 'ar' || mem === 'en') return mem
  const disk = readDiskStore()[normalized]
  if (disk === 'ar' || disk === 'en') {
    store.set(normalized, disk)
    return disk
  }
  return null
}

export function saveUserLocale(email: string, locale: AccountLocale): void {
  const normalized = email.trim().toLowerCase()
  if (!normalized || (locale !== 'ar' && locale !== 'en')) return
  const store = getMemoryStore()
  store.set(normalized, locale)
  writeDiskStore(store)
}
