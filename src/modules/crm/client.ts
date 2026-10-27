// Browser-safe public API of the CRM module: types, Zod schemas and pure rules. It must never import server code.
export { createCustomerSchema, listCustomersQuerySchema, updateCustomerSchema } from '@/modules/crm/schemas/customer'
export type { CreateCustomerInput, ListCustomersQuery, UpdateCustomerInput } from '@/modules/crm/schemas/customer'
export { createLeadSchema, listLeadsQuerySchema, moveLeadSchema, updateLeadSchema } from '@/modules/crm/schemas/lead'
export type { CreateLeadInput, ListLeadsQuery, MoveLeadInput, UpdateLeadInput } from '@/modules/crm/schemas/lead'
export {
  createQuotationSchema,
  listQuotationsQuerySchema,
  quotationLineSchema,
  updateQuotationSchema,
} from '@/modules/crm/schemas/quotation'
export type {
  CreateQuotationInput,
  ListQuotationsQuery,
  QuotationLineInput,
  UpdateQuotationInput,
} from '@/modules/crm/schemas/quotation'
export { versionBodySchema } from '@/modules/crm/schemas/common'
export {
  addDays,
  assertWithinCreditLimit,
  canTransition,
  discountedUnitPrice,
  effectiveStatus,
  INVOICE_DUE_DAYS,
  isPastValidity,
  utcDate,
} from '@/modules/crm/domain/quotation'
export { isClosedStage, summarizeStages } from '@/modules/crm/domain/lead'
export {
  customerStatuses,
  customerTypes,
  leadStages,
  openLeadStages,
  quotationStatuses,
} from '@/modules/crm/domain/types'
export type {
  ActivityEntry,
  ActivityKind,
  ConversionResult,
  Customer,
  CustomerContact,
  CustomerProfile,
  CustomerRef,
  CustomerStatus,
  CustomerType,
  Lead,
  LeadStage,
  OpenLeadStage,
  Quotation,
  QuotationDetail,
  QuotationLine,
  QuotationStatus,
  StageSummary,
  StalledLead,
  TeamMember,
} from '@/modules/crm/domain/types'
