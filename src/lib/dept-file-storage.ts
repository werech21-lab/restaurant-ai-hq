/**
 * Zero-Blob department file storage (shared by all smart-ingest modules).
 * Always sanitize keys — Supabase rejects spaces/Arabic/symbols with validation errors.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient as createSupabaseBrowser } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'
import { safeStorageKey } from '@/lib/hr-file-storage'

export { safeStorageKey }

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'hr-documents'

function localRoot() {
  if (process.env.VERCEL) return path.join('/tmp', 'aetherbi-dept-files')
  return path.join(process.cwd(), 'data', 'dept-files')
}

export type StoredDeptFile = {
  fileUrl: string
  fileType: string
  storageKey: string
  sizeBytes: number
}

export async function storeDeptBinary(input: {
  buffer: Buffer
  fileName: string
  mimeType: string
  module: string
  entityKey?: string | null
}): Promise<StoredDeptFile> {
  const ext = path.extname(input.fileName) || ''
  const hash = createHash('sha1').update(input.buffer).digest('hex').slice(0, 12)
  const folder = safeStorageKey(input.module)
  const entity = safeStorageKey(input.entityKey || 'unmatched')
  const leaf = safeStorageKey(input.fileName || `file${ext}`)
  const key = `${folder}/${entity}/${Date.now()}_${hash}_${leaf}`
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
      logger.warn('dept_storage_supabase_fallback', { errorMessage: error.message, key })
    } catch (error) {
      logger.warn('dept_storage_supabase_error', {
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

export function readLocalDeptFile(storageKey: string): { buffer: Buffer; abs: string } | null {
  const abs = path.join(localRoot(), storageKey)
  if (!existsSync(abs)) return null
  return { buffer: readFileSync(abs), abs }
}

export function newDeptBatchId() {
  return `dept_${randomUUID().replace(/-/g, '').slice(0, 16)}`
}
