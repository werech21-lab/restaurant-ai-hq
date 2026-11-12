#!/usr/bin/env node
/**
 * Venture Foods — Parallel Dual-PC Safe Sync & Push Engine (`PC #1 <-> PC #2`)
 * Usage:
 *   npm run safe-push -- "feat(scope): concise commit message"
 *   node scripts/parallel-sync-push.mjs --check-only
 */

import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const args = process.argv.slice(2)
const checkOnly = args.includes('--check-only') || args.includes('--dry-run')
const messageArgs = args.filter((a) => a !== '--check-only' && a !== '--dry-run' && a !== '-m')
const commitMessage = messageArgs.join(' ').trim()

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    stdio: opts.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  })
}

function assertZeroSecrets() {
  console.log('\n🔒 [Rule 3] Running Zero-Secret-Leak Scan on tracked & staged files...')

  const forbiddenFiles = ['.env', '.env.local', '.env.staging', '.env.production']
  for (const f of forbiddenFiles) {
    const tracked = run(`git ls-files "${f}"`, { capture: true }).trim()
    if (tracked) {
      console.error(`❌ BLOCKED: Sensitive env file "${f}" is tracked in Git! Run: git rm --cached ${f}`)
      process.exit(1)
    }
  }

  // Joined at runtime so this script never self-matches git grep -F
  const blockedPatterns = [
    { name: 'Google AQ Auth Prefix', pat: ['A', 'Q', '.', 'A', 'b', '8'].join('') },
    { name: 'Google AQ Auth Segment', pat: ['A', 'b', '8', 'R', 'N', '6'].join('') },
    { name: 'Anthropic Raw Prefix', pat: ['s', 'k', '-', 'a', 'n', 't'].join('') },
    { name: 'Anthropic Base64 Prefix', pat: ['c2st', 'YW50'].join('') },
    { name: 'xAI Grok Raw Prefix', pat: ['x', 'a', 'i', '-'].join('') },
    { name: 'Google Legacy Key Prefix', pat: ['A', 'I', 'z', 'a'].join('') },
  ]

  for (const { name, pat } of blockedPatterns) {
    let matches = ''
    try {
      matches = run(`git grep -F "${pat}"`, { capture: true }).trim()
    } catch {
      matches = ''
    }
    if (matches) {
      console.error(`❌ BLOCKED: Secret pattern [${name}] detected in tracked files:\n${matches}`)
      process.exit(1)
    }
  }

  console.log('✅ Zero secret leaks detected across all tracked files.')
}

console.log('======================================================================')
console.log('  Aether BI — Dual-PC Anti-Conflict Safe Push Pipeline (PC #1 <-> PC #2)')
console.log('======================================================================')

// 1. Pre-check secret hygiene before staging
assertZeroSecrets()

// 2. Run forensic integrity, TypeScript, and Next.js production build gates
console.log('\n🧪 [Gate 1/3] Verifying Enterprise Brain & 0.000 KWD Odoo Integrity...')
run('node scripts/verify-brain-integrity.mjs')

console.log('\n📐 [Gate 2/3] Running TypeScript strict check (npx tsc --noEmit)...')
run('npx tsc --noEmit')

console.log('\n🏗️  [Gate 3/3] Running Next.js production build (npm run build)...')
run('npm run build')

if (checkOnly) {
  console.log('\n✅ --check-only complete: All gates & secret checks passed.')
  process.exit(0)
}

// 3. Stage & commit if working tree has changes
const statusBefore = run('git status --porcelain', { capture: true }).trim()
if (statusBefore) {
  if (!commitMessage) {
    console.error('\n❌ Working tree has uncommitted changes, but no commit message was provided.')
    console.error('   Usage: npm run safe-push -- "feat(scope): description"')
    process.exit(1)
  }
  console.log('\n📦 Staging changes (git add -A)...')
  run('git add -A')

  // Re-verify after staging to guarantee no secret slipped into index
  assertZeroSecrets()

  const escapedMsg = commitMessage.replace(/"/g, '\\"')
  console.log(`\n📝 Committing: "${commitMessage}"...`)
  run(`git commit -m "${escapedMsg}"`)
} else {
  console.log('\nℹ️  Working tree clean — checking if local branch has unpushed commits...')
}

// 4. Rebase onto latest origin/main & push
console.log('\n🔄 [Rule 2] Fetching & rebasing onto latest origin/main...')
run('git fetch origin main --prune')
run('git pull --rebase origin main')

console.log('\n🚀 Pushing cleanly to origin/main...')
run('git push origin main')

console.log('\n✅ SAFE PUSH COMPLETE — PC #1 & PC #2 synchronized on origin/main!')
