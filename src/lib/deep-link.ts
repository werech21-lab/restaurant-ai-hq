import { z } from 'zod'

const uuid = z.string().uuid()

/** A record id taken from the address bar. Anything that is not a single valid UUID is ignored. */
export function deepLinkId(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null
  const parsed = uuid.safeParse(value)
  return parsed.success ? parsed.data : null
}