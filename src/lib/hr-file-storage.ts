/**
 * Zero-Blob HR file storage: binaries live on disk (or /tmp on Vercel), never in SQL columns.
 * Optional Supabase Storage when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_STORAGE_BUCKET are set
 * and the anon client can write; otherwise local filesystem fallback.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createClient as createSupabaseBrowser } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'hr-documents'

function localRoot() {
  if (process.env.VERCEL) return path.join('/tmp', 'aetherbi-hr-files')
  return path.join(process.cwd(), 'data', 'hr-files')
}

/**
 * Always sanitize storage object keys.
 * Spaces, Arabic, parentheses and symbols make Supabase Storage return
 * "The request did not pass validation".
 */
export function safeStorageKey(name: string) {
  const base = name.split(/[/\\]/).pop() || name
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 120)
  return cleaned || 'file'
}

export type StoredHrFile = {
  fileUrl: string
  fileType: string
  storageKey: string
  sizeBytes: number
}

export async function storeHrBinary(input: {
  buffer: Buffer
  fileName: string
  mimeType: string
  employeeCode?: string | null
}): Promise<StoredHrFile> {
  const ext = path.extname(input.fileName) || ''
  const hash = createHash('sha1').update(input.buffer).digest('hex').slice(0, 12)
  const folder = safeStorageKey(input.employeeCode || 'unmatched')
  const leaf = safeStorageKey(input.fileName || `file${ext}`)
  const key = `${folder}/${Date.now()}_${hash}_${leaf}`
  const fileType = input.mimeType || 'application/octet-stream'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseKey && process.env.HR_STORAGE_MODE !== 'local') {
    try {
      const client = createSupabaseBrowser(supabaseUrl, supabaseKey)
      const { error } = await client.storage.from(BUCKET).upload(key, input.buffer, {
        contentType: fileType,
        upsert: false,
      })
      if (!error) {
        const { data } = client.storage.from(BUCKET).getPublicUrl(key)
        return {
          fileUrl: data.publicUrl,
          fileType,
          storageKey: key,
          sizeBytes: input.buffer.byteLength,
        }
      }
      logger.warn('hr_storage_supabase_fallback', { errorMessage: error.message })
    } catch (error) {
      logger.warn('hr_storage_supabase_error', {
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const root = localRoot()
  const abs = path.join(root, key)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, input.buffer)
  const token = Buffer.from(key).toString('base64url')
  return {
    fileUrl: `/api/hr/files/${token}`,
    fileType,
    storageKey: key,
    sizeBytes: input.buffer.byteLength,
  }
}

export function readLocalHrFile(storageKey: string): { buffer: Buffer; abs: string } | null {
  const abs = path.join(localRoot(), storageKey)
  if (!existsSync(abs)) return null
  return { buffer: readFileSync(abs), abs }
}

export function decodeFileToken(token: string): string | null {
  try {
    const key = Buffer.from(token, 'base64url').toString('utf8')
    if (!key || key.includes('..') || path.isAbsolute(key)) return null
    return key
  } catch {
    return null
  }
}

export function newStorageBatchId() {
  return `batch_${randomUUID().replace(/-/g, '').slice(0, 16)}`
}
