import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The event catalogue in docs/EVENT_DESIGN.md and the events the code can emit must be the same list, and every name must
 * follow `<module>.<entity>.<past_tense>`. An event added in code without a catalogue row fails here.
 */

const NAME = /^[a-z]+\.[a-z]+(?:_[a-z]+)*\.[a-z]+(?:_[a-z]+)*$/
const root = process.cwd()

async function sourceFiles(directory: string): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      found.push(...(await sourceFiles(full)))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      found.push(full)
    }
  }
  return found
}

async function emittedNames(): Promise<string[]> {
  const names = new Set<string>()
  for (const file of await sourceFiles(path.join(root, 'src'))) {
    const text = await readFile(file, 'utf8')
    for (const match of text.matchAll(/\bname:\s*'([a-z_]+\.[a-z_]+\.[a-z_]+)'/g)) names.add(match[1])
  }
  return [...names].sort()
}

async function documentedNames(): Promise<string[]> {
  const text = await readFile(path.join(root, 'docs', 'EVENT_DESIGN.md'), 'utf8')
  const section = text.split('<!-- implemented:start -->')[1]?.split('<!-- implemented:end -->')[0] ?? ''
  return [...section.matchAll(/^\| `([a-z_.]+)` \|/gm)].map((match) => match[1]).sort()
}

describe('the event catalogue', () => {
  it('lists exactly the events the code emits', async () => {
    const documented = await documentedNames()
    expect(documented.length).toBeGreaterThan(30)
    expect(documented).toEqual(await emittedNames())
  })

  it('uses <module>.<entity>.<past_tense> for every name', async () => {
    for (const name of await emittedNames()) expect(name, name).toMatch(NAME)
  })
})
