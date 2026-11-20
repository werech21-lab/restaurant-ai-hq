export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
export const DEFAULT_XAI_MODEL = 'grok-4'

export interface CouncilModels {
  anthropic: string
  google: string
  xai: string
}

export function resolveCouncilModels(env: NodeJS.ProcessEnv = process.env): CouncilModels {
  return {
    anthropic: env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL,
    google: env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    xai: env.XAI_MODEL?.trim() || DEFAULT_XAI_MODEL,
  }
}
