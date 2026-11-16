import 'server-only'
import { createHash } from 'node:crypto'
import { readCouncilKeys, type CouncilKeys } from './env'
import { resolveCouncilModels, type CouncilModels } from './models'
import { COUNCIL_PROVIDERS, pingProvider, type ProviderId } from './providers'

export const COUNCIL_HEALTH_TTL_MS = 5 * 60_000
export const COUNCIL_HEALTH_TIMEOUT_MS = 8_000

export interface CouncilProviderHealth {
  provider: ProviderId
  ready: boolean
  modelId: string
  latencyMs: number
  errorCode: string | null
}

export interface CouncilHealth {
  checkedAt: string
  cached: boolean
  providers: CouncilProviderHealth[]
}

interface HealthCache {
  at: number
  fingerprint: string
  value: CouncilHealth
}

let cache: HealthCache | null = null

export function resetCouncilHealthCache(): void {
  cache = null
}

function fingerprint(keys: CouncilKeys, models: CouncilModels): string {
  return createHash('sha256')
    .update(JSON.stringify({ keys, models }))
    .digest('hex')
}

export async function probeCouncilHealth(options: {
  force?: boolean
  now?: number
  keys?: CouncilKeys
  models?: CouncilModels
  fetchImpl?: typeof fetch
  timeoutMs?: number
} = {}): Promise<CouncilHealth> {
  const now = options.now ?? Date.now()
  const keys = options.keys ?? readCouncilKeys()
  const models = options.models ?? resolveCouncilModels()
  const print = fingerprint(keys, models)
  if (!options.force && cache && cache.fingerprint === print && now - cache.at < COUNCIL_HEALTH_TTL_MS) {
    return { ...cache.value, cached: true, providers: cache.value.providers.map((item) => ({ ...item })) }
  }

  const pings = await Promise.all(
    COUNCIL_PROVIDERS.map((provider) =>
      pingProvider({
        provider,
        apiKey: keys[provider],
        timeoutMs: options.timeoutMs ?? COUNCIL_HEALTH_TIMEOUT_MS,
        fetchImpl: options.fetchImpl,
      }),
    ),
  )

  const value: CouncilHealth = {
    checkedAt: new Date(now).toISOString(),
    cached: false,
    providers: pings.map((ping) => ({
      provider: ping.provider,
      ready: ping.ready,
      modelId: ping.ready ? models[ping.provider] : '',
      latencyMs: ping.latencyMs,
      errorCode: ping.errorCode,
    })),
  }
  cache = { at: now, fingerprint: print, value }
  return value
}
