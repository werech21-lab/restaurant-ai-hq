export const suiteApps = [
  'crm_pipeline',
  'sales_orders',
  'pos_sessions',
  'subscriptions',
  'analytic',
  'mrp',
  'plm',
  'maintenance',
  'recruitment',
  'projects',
  'timesheets',
  'helpdesk',
  'website',
  'ecommerce',
  'email',
  'automation',
] as const

export type SuiteApp = (typeof suiteApps)[number]

export const suiteStages: Record<SuiteApp, readonly string[]> = {
  crm_pipeline: ['new', 'qualified', 'proposal', 'won'],
  sales_orders: ['quotation', 'confirmed', 'delivered', 'invoiced'],
  pos_sessions: ['opening', 'selling', 'closing', 'closed'],
  subscriptions: ['draft', 'active', 'paused', 'closed'],
  analytic: ['draft', 'posted'],
  mrp: ['planned', 'progress', 'done', 'cancelled'],
  plm: ['draft', 'review', 'approved', 'released'],
  maintenance: ['request', 'scheduled', 'in_progress', 'done'],
  recruitment: ['new', 'interview', 'offer', 'hired'],
  projects: ['backlog', 'active', 'blocked', 'done'],
  timesheets: ['logged'],
  helpdesk: ['new', 'progress', 'waiting', 'solved'],
  website: ['draft', 'published', 'archived'],
  ecommerce: ['cart', 'paid', 'preparing', 'delivered'],
  email: ['draft', 'scheduled', 'sent', 'done'],
  automation: ['draft', 'running', 'paused', 'done'],
}

export function isSuiteApp(value: string): value is SuiteApp {
  return (suiteApps as readonly string[]).includes(value)
}
