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

export function isAiDailyBriefEnabled(flag = process.env.AI_DAILY_BRIEF_ENABLED): boolean {
  const raw = (flag ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true'
}
