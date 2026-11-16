export interface CouncilKeys {
  anthropic: string
  google: string
  xai: string
}

export function readCouncilKeys(env: NodeJS.ProcessEnv = process.env): CouncilKeys {
  return {
    anthropic: (env.ANTHROPIC_API_KEY ?? '').trim(),
    google: (env.GEMINI_API_KEY ?? '').trim(),
    xai: (env.XAI_API_KEY ?? '').trim(),
  }
}

const MIN_COUNCIL_KEY_LENGTH = 20

/** Env var names that are absent. Values are never returned. */
export function missingCouncilKeyNames(keys: CouncilKeys = readCouncilKeys()): string[] {
  const missing: string[] = []
  if (keys.anthropic.length < MIN_COUNCIL_KEY_LENGTH) missing.push('ANTHROPIC_API_KEY')
  if (keys.google.length < MIN_COUNCIL_KEY_LENGTH) missing.push('GEMINI_API_KEY')
  if (keys.xai.length < MIN_COUNCIL_KEY_LENGTH) missing.push('XAI_API_KEY')
  return missing
}

/**
 * The morning background analysis is scheduled unless this flag is `0`, `false`, or `off`.
 * An empty value keeps the schedule on. The job still refuses to call a provider when its key is missing.
 */
export function isBackgroundAnalysisEnabled(flag = process.env.AI_DAILY_BRIEF_ENABLED): boolean {
  const raw = (flag ?? '').trim().toLowerCase()
  return raw !== '0' && raw !== 'false' && raw !== 'off'
}

export function isAiDailyBriefEnabled(flag = process.env.AI_DAILY_BRIEF_ENABLED): boolean {
  return isBackgroundAnalysisEnabled(flag)
}
