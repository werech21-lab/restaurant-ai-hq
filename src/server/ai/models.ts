export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'
export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-pro-preview'
export const DEFAULT_XAI_MODEL = 'grok-4'

export const DEFAULT_ANTHROPIC_FALLBACK_MODEL = 'claude-haiku-4-5'
export const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-2.5-flash'
export const DEFAULT_XAI_FALLBACK_MODEL = 'grok-3-mini'

export interface CouncilModels {
  anthropic: string
  google: string
  xai: string
}

export const PROVIDER_DEFAULT_TIMEOUT_MS: Readonly<Record<keyof CouncilModels, number>> = {
  anthropic: 11_000,
  google: 11_000,
  xai: 11_000,
}

export function resolveCouncilModels(env: NodeJS.ProcessEnv = process.env): CouncilModels {
  return {
    anthropic: env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
    google: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    xai: env.XAI_MODEL?.trim() || DEFAULT_XAI_MODEL,
  }
}

export function resolveFallbackCouncilModels(env: NodeJS.ProcessEnv = process.env): CouncilModels {
  return {
    anthropic: env.ANTHROPIC_FALLBACK_MODEL?.trim() || DEFAULT_ANTHROPIC_FALLBACK_MODEL,
    google: env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_GEMINI_FALLBACK_MODEL,
    xai: env.XAI_FALLBACK_MODEL?.trim() || DEFAULT_XAI_FALLBACK_MODEL,
  }
}
