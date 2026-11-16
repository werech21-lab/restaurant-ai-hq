/**
 * Server-side AI key readers. Values come only from environment variables.
 * There is no embedded fallback and no browser override on this path.
 */

import { isValidGeminiApiKey } from './ai-keys-client'

export {
  AI_KEY_STORAGE_KEYS,
  getAnthropicBrowserOverride,
  getGeminiBrowserOverride,
  getOpenAiBrowserOverride,
  hasAnthropicBrowserOverride,
  hasGeminiBrowserOverride,
  isValidGeminiApiKey,
} from './ai-keys-client'

function readEnv(name: string): string {
  const value = process.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

export function getAnthropicApiKey(): string {
  return readEnv('ANTHROPIC_API_KEY')
}

export function hasAnthropicApiKey(): boolean {
  return getAnthropicApiKey().length > 14
}

export function getGeminiApiKey(): string {
  return readEnv('GEMINI_API_KEY')
}

export function hasGeminiApiKey(): boolean {
  return isValidGeminiApiKey(getGeminiApiKey())
}

export function getXaiApiKey(): string {
  return readEnv('XAI_API_KEY')
}

export function getOpenAIApiKey(): string {
  return readEnv('OPENAI_API_KEY')
}
