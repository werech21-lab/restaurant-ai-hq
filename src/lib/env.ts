import { z } from 'zod'
import { AppError } from '@/lib/api/errors'
import { logger } from '@/lib/logger'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_SSL: z.enum(['require', 'verify', 'disable']).default('require'),
  DATABASE_SSL_CA: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

let cached: Env | null = null

/** Validates server environment variables the first time an ERP module needs them. */
export function getEnv(): Env {
  if (cached) return cached
  const parsed = envSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_SSL: process.env.DATABASE_SSL,
    DATABASE_SSL_CA: process.env.DATABASE_SSL_CA || undefined,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
  if (!parsed.success) {
    logger.error('Invalid server environment', { fields: parsed.error.issues.map((issue) => issue.path.join('.')) })
    throw new AppError(500, 'server_misconfigured', 'The server is not configured.')
  }
  cached = parsed.data
  return cached
}
