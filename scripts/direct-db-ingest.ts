/**
 * Direct Local-to-Database Ingestion CLI (Zero-Bandwidth by default).
 *
 * Usage:
 *   npx tsx scripts/direct-db-ingest.ts
 *   npx tsx scripts/direct-db-ingest.ts "C:\Users\...\Desktop\Recipes"
 *   npx tsx scripts/direct-db-ingest.ts --scan-desktop-docs
 *   npx tsx scripts/direct-db-ingest.ts --upload-binaries
 *
 * Default: parse locally → SHA-256 idempotent upsert of extracted records into Prisma.
 * Binary cloud upload is opt-in via --upload-binaries.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as XLSX from 'xlsx'
import {
  upsertLocalSmartDropzoneBatch,
  type LocalIngestFileInput,
} from '../src/services/universal-ai-router.service'

const ROOT = process.cwd()
const BATCH_SIZE = 500
const DEFAULT_DROPZONE = path.join(ROOT, 'local-dropzone')
const ALT_DROPZONE = path.join(ROOT, 'local-inbox-dropzone')
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.vercel',
  'dist',
  'build',
  '__pycache__',
  '.turbo',
  'System Volume Information',
  '$RECYCLE.BIN',
])

type CliFlags = {
  roots: string[]
  uploadBinaries: boolean
  scanDesktopDocs: boolean
  dryRun: boolean
  limit: number
}

function parseArgs(argv: string[]): CliFlags {
  const roots: string[] = []
  let uploadBinaries = false
  let scanDesktopDocs = false
  let dryRun = false
  let limit = 50_000
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--upload-binaries') uploadBinaries = true
    else if (arg === '--scan-desktop-docs') scanDesktopDocs = true
    else if (arg === '--dry-run') dryRun = true
    else if (arg === '--limit' && argv[i + 1]) {
      limit = Math.max(1, Number(argv[++i]) || 50_000)
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else if (!arg.startsWith('-')) {
      roots.push(path.resolve(arg))
    }
  }
  return { roots, uploadBinaries, scanDesktopDocs, dryRun, limit }
}

function printHelp() {
  console.log(`
Direct Local-to-DB Ingest (Zero-Bandwidth Local Parsing)

  npx tsx scripts/direct-db-ingest.ts [path...] [flags]

Flags:
  --scan-desktop-docs   Also scan Desktop + Documents work folders
  --upload-binaries     Optional: store binaries in dept object store
  --dry-run             Classify + hash only (no DB writes)
  --limit N             Cap files processed (default 50000)

Default scan root: ./local-dropzone (created if missing)
`)
}

function isSkippedName(name: string): boolean {
  if (!name) return true
  if (name.startsWith('.')) return true
  if (/^~\$./i.test(name) || /^~\$/.test(name)) return true
  if (/^(thumbs\.db|desktop\.ini|\.ds_store)$/i.test(name)) return true
  if (SKIP_DIR_NAMES.has(name)) return true
  return false
}

function acceptFileName(name: string): boolean {
  if (isSkippedName(name)) return false
  return /\.(pdf|xlsx?|docx?|csv|txt|json|md|png|jpe?g|webp|zip)$/i.test(name)
}

function mimeOf(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.pdf')) return 'application/pdf'
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel'
  if (lower.endsWith('.csv')) return 'text/csv'
  if (lower.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (lower.endsWith('.doc')) return 'application/msword'
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return 'text/plain'
  if (lower.endsWith('.json')) return 'application/json'
  if (lower.endsWith('.png')) return 'image/png'
  if (/\.jpe?g$/i.test(lower)) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.zip')) return 'application/zip'
  return 'application/octet-stream'
}

function walkFiles(rootDir: string, out: string[], limit: number) {
  if (out.length >= limit) return
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (out.length >= limit) return
    if (isSkippedName(entry.name)) continue
    const full = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(full, out, limit)
      continue
    }
    if (entry.isFile() && acceptFileName(entry.name)) out.push(full)
  }
}

async function extractDocxText(buf: Buffer): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buf)
    const xml = await zip.file('word/document.xml')?.async('string')
    if (!xml) return ''
    return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 24000)
  } catch {
    return ''
  }
}

function extractSheetText(buf: Buffer, fileName: string): string {
  try {
    const wb = XLSX.read(buf, { type: 'buffer', sheetRows: 60 })
    const parts: string[] = []
    for (const name of wb.SheetNames.slice(0, 4)) {
      const sheet = wb.Sheets[name]
      if (!sheet) continue
      parts.push(`#${name}`)
      parts.push(XLSX.utils.sheet_to_csv(sheet).slice(0, 10000))
    }
    return parts.join('\n').slice(0, 40000)
  } catch {
    return buf.toString('utf8').slice(0, 8000)
  }
}

function extractPdfOrBinaryText(buf: Buffer): string {
  const asLatin = buf.toString('latin1')
  return asLatin
    .replace(/[^\x09\x0a\x0d\x20-\x7e\u0600-\u06ff]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 12000)
}

async function extractText(filePath: string, buf: Buffer, fileName: string): Promise<string> {
  const lower = fileName.toLowerCase()
  if (/\.(txt|csv|json|md)$/i.test(lower)) return buf.toString('utf8').slice(0, 40000)
  if (/\.(xlsx|xls|ods)$/i.test(lower)) return extractSheetText(buf, fileName)
  if (lower.endsWith('.docx')) return extractDocxText(buf)
  if (lower.endsWith('.pdf') || lower.endsWith('.doc')) return extractPdfOrBinaryText(buf)
  if (/\.(png|jpe?g|webp)$/i.test(lower)) return `image:${fileName}`
  return extractPdfOrBinaryText(buf)
}

function sha256Of(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function resolveScanRoots(flags: CliFlags): string[] {
  const roots = new Set<string>()
  for (const r of flags.roots) roots.add(r)

  if (roots.size === 0) {
    if (!fs.existsSync(DEFAULT_DROPZONE)) fs.mkdirSync(DEFAULT_DROPZONE, { recursive: true })
    roots.add(DEFAULT_DROPZONE)
    if (fs.existsSync(ALT_DROPZONE)) roots.add(ALT_DROPZONE)
  }

  if (flags.scanDesktopDocs) {
    const home = os.homedir()
    const desktop = path.join(home, 'Desktop')
    const documents = path.join(home, 'Documents')
    for (const candidate of [
      desktop,
      documents,
      path.join(desktop, 'Recipes'),
      path.join(desktop, 'Menu'),
      path.join(desktop, 'HR'),
      path.join(documents, 'VentureFoods'),
      path.join(documents, 'AetherBI'),
    ]) {
      if (fs.existsSync(candidate)) roots.add(candidate)
    }
  }

  return [...roots]
}

async function main() {
  const flags = parseArgs(process.argv.slice(2))
  const roots = resolveScanRoots(flags)

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  AetherBI Direct Local-to-DB Ingest')
  console.log('  Mode:', flags.uploadBinaries ? 'INDEX + OPTIONAL BINARY UPLOAD' : 'ZERO-BANDWIDTH INDEX (default)')
  console.log('═══════════════════════════════════════════════════════════')
  for (const root of roots) console.log('  Scan root:', root)

  const files: string[] = []
  for (const root of roots) walkFiles(root, files, flags.limit)
  console.log(`  Discovered ${files.length} file(s)`)

  if (files.length === 0) {
    console.log('  Nothing to ingest. Drop files into ./local-dropzone and re-run.')
    process.exit(0)
  }

  const prepared: LocalIngestFileInput[] = []
  let readErrors = 0
  const t0 = Date.now()

  for (let i = 0; i < files.length; i += 1) {
    const abs = files[i]!
    const fileName = path.basename(abs)
    let relativePath = abs
    for (const root of roots) {
      if (abs.startsWith(root)) {
        relativePath = path.relative(root, abs) || fileName
        break
      }
    }
    relativePath = relativePath.replace(/\\/g, '/')

    try {
      const buf = fs.readFileSync(abs)
      const sha256 = sha256Of(buf)
      const textContent = await extractText(abs, buf, fileName)
      prepared.push({
        relativePath,
        fileName,
        mimeType: mimeOf(fileName),
        sizeBytes: buf.byteLength,
        textContent: `${relativePath}\n${fileName}\n${textContent}`,
        buffer: flags.uploadBinaries ? buf : null,
        sha256,
      })
    } catch (error) {
      readErrors += 1
      console.warn(`  skip read: ${fileName} — ${error instanceof Error ? error.message : String(error)}`)
    }

    if ((i + 1) % 100 === 0 || i === files.length - 1) {
      process.stdout.write(`\r  Parsed ${i + 1}/${files.length}…`)
    }
  }
  console.log('')
  console.log(`  Parsed in ${((Date.now() - t0) / 1000).toFixed(2)}s (read errors: ${readErrors})`)

  if (flags.dryRun) {
    console.log(`  Dry-run complete. Would upsert ${prepared.length} record(s).`)
    process.exit(0)
  }

  let inserted = 0
  let updated = 0
  let skipped = 0
  let processed = 0
  const batchId = `local_${Date.now()}`
  const actorId = process.env.INGEST_ACTOR_ID || 'local-cli'

  for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
    const slice = prepared.slice(i, i + BATCH_SIZE)
    const result = await upsertLocalSmartDropzoneBatch({
      actorId,
      batchId,
      uploadBinaries: flags.uploadBinaries,
      files: slice,
    })
    inserted += result.inserted
    updated += result.updated
    skipped += result.skipped
    processed += result.processed
    console.log(
      `  Batch ${Math.floor(i / BATCH_SIZE) + 1}: +${result.inserted} insert / ~${result.updated} update / ${result.skipped} skip`,
    )
  }

  console.log('───────────────────────────────────────────────────────────')
  console.log(`  Done. processed=${processed} inserted=${inserted} updated=${updated} skipped=${skipped}`)
  console.log(`  Batch: ${batchId}`)
  console.log('  Open /erp/smart-dropzone or /erp/archive to review with the local-ingest badge.')
  console.log('═══════════════════════════════════════════════════════════')
}

main().catch((error) => {
  console.error('FATAL:', error instanceof Error ? error.message : error)
  process.exit(1)
})
