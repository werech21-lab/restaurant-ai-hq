import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

async function source(rel: string): Promise<string> {
  return readFile(path.join(ROOT, rel), 'utf8')
}

function updateBlocks(text: string): string[] {
  const blocks: string[] = []
  const needle = '.user.update('
  let from = 0
  while (from < text.length) {
    const start = text.indexOf(needle, from)
    if (start < 0) break
    const open = text.indexOf('{', start)
    let depth = 0
    let end = open
    for (; end < text.length; end += 1) {
      if (text[end] === '{') depth += 1
      if (text[end] === '}') {
        depth -= 1
        if (depth === 0) {
          end += 1
          break
        }
      }
    }
    blocks.push(text.slice(start, end))
    from = end
  }
  return blocks
}

describe('existing account passwords', () => {
  it('keeps password hashes off every update of an existing user', async () => {
    const files = [
      'src/lib/ensure-venture-foods-team.ts',
      'src/services/rbac.service.ts',
      'scripts/sync-vf-users.ts',
      'prisma/seed.ts',
    ]
    for (const file of files) {
      const text = await source(file)
      for (const block of updateBlocks(text)) {
        expect(block, file).not.toContain('passwordHash')
      }
    }
  })

  it('does not delete or deactivate an existing user from the seed or sync paths', async () => {
    for (const file of ['prisma/seed.ts', 'scripts/sync-vf-users.ts', 'src/lib/ensure-venture-foods-team.ts']) {
      const text = await source(file)
      expect(text, file).not.toContain('user.deleteMany')
      expect(text, file).not.toContain('user.delete(')
      expect(text, file).not.toContain('isActive: false')
    }
  })

  it('writes a seed password only when the user table is empty', async () => {
    const text = await source('prisma/seed.ts')
    const guard = text.indexOf('if (keptUsers.length > 0)')
    const emptyBranch = text.indexOf('} else {', guard)
    const create = text.indexOf('tx.user.create')
    expect(guard).toBeGreaterThan(-1)
    expect(emptyBranch).toBeGreaterThan(guard)
    expect(create).toBeGreaterThan(emptyBranch)
    const kept = text.slice(guard, emptyBranch)
    expect(kept).toContain('adminId = preferred.id')
    expect(kept).not.toContain('passwordHash')
    expect(kept).not.toContain('bcrypt')
  })

  it('refuses a profile password change before any hash is written', async () => {
    const text = await source('src/services/rbac.service.ts')
    expect(text).toContain('لا يمكن تغيير كلمة مرور حساب موجود.')
    const profile = text.slice(text.indexOf('export async function updateProfile'))
    expect(profile).not.toContain('bcrypt.hash')
    expect(profile).not.toContain('passwordHash')
  })

  it('leaves the executive password constants as compare-only values', async () => {
    const text = await source('src/lib/auth/exec-session.ts')
    expect(text).toContain("role: 'marketing'")
    expect(text).toContain("role: 'supply'")
    expect(text).not.toContain('bcrypt')
    expect(text).not.toContain('passwordHash')
    expect(text).not.toContain('.user.update')
    expect(text).not.toContain('.user.create')
  })

  it('fills an employee PIN only when that employee has none', async () => {
    const text = await source('src/services/ess.service.ts')
    expect(text).toContain('if (emp.pinHash) return emp')
  })
})
