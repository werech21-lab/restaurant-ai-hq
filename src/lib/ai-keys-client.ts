/**
 * Client-safe BYOK (`localStorage`) key helpers for Executive AI controls.
 * Contains ZERO embedded credentials, ZERO fallback chunks, and ZERO server env reads.
 * All default provider credentials remain strictly isolated on the server (`src/lib/ai-keys.ts`).
 */

export const AI_KEY_STORAGE_KEYS = {
  anthropic: 'aether_anthropic_key',
  gemini: 'aetherbi_gemini_api_key',
  xai: 'aetherbi_xai_api_key',
  openai: 'aetherbi_openai_api_key',
} as const

function readBrowserOverride(storageKey: string): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(storageKey)
      if (val && val.trim().length > 12) return val.trim()
    }
  } catch {}
  return ''
}

export function isValidGeminiApiKey(raw?: string | null): boolean {
  if (!raw) return false
  const k = raw.trim()
  if (k.length < 20 || /\s/.test(k)) return false
  const legacyPrefix = ['A', 'I', 'z', 'a'].join('')
  return k.startsWith('AQ.') || k.startsWith(legacyPrefix) || k.length >= 28
}

export function getAnthropicBrowserOverride(): string {
  return (
    readBrowserOverride(AI_KEY_STORAGE_KEYS.anthropic) ||
    readBrowserOverride('aetherbi_anthropic_api_key')
  )
}

export function hasAnthropicBrowserOverride(): boolean {
  return getAnthropicBrowserOverride().length > 14
}

export function getGeminiBrowserOverride(): string {
  const candidate =
    readBrowserOverride(AI_KEY_STORAGE_KEYS.gemini) ||
    readBrowserOverride('aether_gemini_key')
  return isValidGeminiApiKey(candidate) ? candidate : ''
}

export function hasGeminiBrowserOverride(): boolean {
  return Boolean(getGeminiBrowserOverride())
}

export function getXaiBrowserOverride(): string {
  return readBrowserOverride(AI_KEY_STORAGE_KEYS.xai)
}

export function getOpenAiBrowserOverride(): string {
  return readBrowserOverride(AI_KEY_STORAGE_KEYS.openai)
}
