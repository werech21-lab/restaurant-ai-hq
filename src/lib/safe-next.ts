const ALLOWED = /^\/(admin|erp)(\/[A-Za-z0-9\-_]+)*$/

/** Returns `value` only when it is an internal path under /admin or /erp. Anything else, such as //evil.com, becomes the fallback. */
export function safeNextPath(value: string | null | undefined, fallback = '/admin'): string {
  if (!value) return fallback
  return ALLOWED.test(value) ? value : fallback
}
