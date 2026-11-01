/** Builds the Arabic manager alert for a new website trial lead. Pure and deterministic. */
export function buildTrialAlertMessage(input: {
  fullName: string
  phone: string
  companyName?: string | null
  leadId: string
  customerId: string
}): string {
  const company = input.companyName?.trim() ? input.companyName.trim() : '—'
  return [
    'طلب نسخة تجريبية جديد من موقع AetherBI',
    `الاسم: ${input.fullName}`,
    `الجوال: ${input.phone}`,
    `الشركة: ${company}`,
    `فرصة CRM: ${input.leadId}`,
    `عميل: ${input.customerId}`,
  ].join('\n')
}
