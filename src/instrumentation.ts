/**
 * Runs once when the server starts. Subscribes the AI module to inventory events, so a stock item falling to its reorder
 * level is looked at as it happens. The event bus lives in this process only, so the subscription is per server instance.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerAiEventHandlers } = await import('@/modules/ai')
    registerAiEventHandlers()
  }
}
