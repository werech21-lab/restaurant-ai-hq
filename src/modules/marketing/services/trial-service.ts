import { createHash, randomUUID } from 'node:crypto'
import { AppError } from '@/lib/api/errors'
import type { AuthContext } from '@/lib/auth/context'
import { permissions } from '@/lib/auth/permissions'
import { withTransaction } from '@/lib/pg'
import { logger } from '@/lib/logger'
import { createCustomer, createLead } from '@/modules/crm'
import type { TrialRequestInput } from '@/modules/marketing/schemas/trial'
import { notifyManagersOfTrialLead } from '@/modules/marketing/services/notify-service'

type MarketingActor = { tenantId: string; userId: string }

async function resolveMarketingActor(): Promise<MarketingActor> {
  const slug = process.env.MARKETING_TENANT_SLUG?.trim() || null
  return withTransaction(async (tx) => {
    const result = await tx.query<{ tenantId: string; userId: string }>(
      `select t.id as "tenantId", m.user_id as "userId"
       from tenants t
       join tenant_members m on m.tenant_id = t.id and m.status = 'active'
       join roles r on r.id = m.role_id
       where t.status = 'active'
         and ($1::text is null or t.slug = $1)
       order by case when r.name ilike '%owner%' then 0 else 1 end, t.created_at asc, m.created_at asc
       limit 1`,
      [slug],
    )
    const row = result.rows[0]
    if (!row) throw new AppError(500, 'marketing_unavailable', 'No active tenant is configured to receive website leads.')
    return row
  })
}

function marketingAuth(actor: MarketingActor): AuthContext {
  return {
    tenantId: actor.tenantId,
    userId: actor.userId,
    permissions: new Set([permissions.crmCustomerCreate, permissions.crmLeadCreate, permissions.crmCustomerRead, permissions.crmLeadRead]),
  }
}

function idempotencyKeyFor(phone: string): string {
  const digest = createHash('sha256').update(`trial:${phone.trim()}`).digest('hex').slice(0, 32)
  return `web-trial-${digest}`
}

/** Captures a website trial request as a CRM lead (customer status lead) and notifies managers. */
export async function submitTrialRequest(input: TrialRequestInput): Promise<{
  data: { leadId: string; customerId: string; notified: { telegram: boolean; whatsapp: boolean } }
}> {
  const actor = await resolveMarketingActor()
  const auth = marketingAuth(actor)
  const company = input.companyName?.trim() || null
  const customer = await createCustomer(auth, {
    name: company ? `${input.fullName} — ${company}` : input.fullName,
    customerType: 'company',
    status: 'lead',
    email: null,
    phone: input.phone,
    taxId: null,
    address: null,
    creditLimitMinor: null,
    notes: [
      'مصدر: موقع AetherBI — طلب نسخة تجريبية',
      company ? `الشركة: ${company}` : null,
      input.notes?.trim() ? `ملاحظة الزائر: ${input.notes.trim()}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  })

  const leadResult = await createLead(auth, idempotencyKeyFor(input.phone) || randomUUID(), {
    customerId: customer.id,
    title: `تجربة AetherBI — ${input.fullName}`,
    expectedRevenueMinor: 0,
    probability: 20,
    assignedTo: null,
    expectedCloseDate: null,
    notes: `هاتف: ${input.phone}${company ? ` · شركة: ${company}` : ''}${input.notes?.trim() ? ` · ${input.notes.trim()}` : ''}`,
    stage: 'new',
  })

  const leadId = leadResult.body.data.id
  const notified = await notifyManagersOfTrialLead({
    fullName: input.fullName,
    phone: input.phone,
    companyName: company,
    leadId,
    customerId: customer.id,
  })
  logger.info('Website trial lead captured', { leadId, customerId: customer.id, telegram: notified.telegram, whatsapp: notified.whatsapp })
  return { data: { leadId, customerId: customer.id, notified } }
}
