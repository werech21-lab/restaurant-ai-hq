export type PageOdooSyncDetail = {
  connected: boolean
  lastSyncAt: string | null
  source: 'live-comparison' | 'odoo-sync' | 'feryal-chat'
}

type Listener = (value: PageOdooSyncDetail | null) => void

let current: PageOdooSyncDetail | null = null
const listeners = new Set<Listener>()

export function publishPageOdooSync(detail: PageOdooSyncDetail | null) {
  current = detail
  for (const listener of listeners) listener(current)
}

export function subscribePageOdooSync(listener: Listener) {
  listeners.add(listener)
  listener(current)
  return () => {
    listeners.delete(listener)
  }
}
