// Server-side public API of the CRM module. Browser code imports from './client' instead.
export {
  createCustomerHandler,
  customerProfileHandler,
  getCustomerHandler,
  listCustomersHandler,
  updateCustomerHandler,
} from '@/modules/crm/api/v1/customers'
export {
  createLeadHandler,
  getLeadHandler,
  leadSummaryHandler,
  listLeadsHandler,
  moveLeadHandler,
  teamHandler,
  updateLeadHandler,
} from '@/modules/crm/api/v1/leads'
export {
  acceptQuotationHandler,
  convertQuotationHandler,
  createQuotationHandler,
  expireQuotationHandler,
  getQuotationHandler,
  listQuotationsHandler,
  rejectQuotationHandler,
  sendQuotationHandler,
  updateQuotationHandler,
} from '@/modules/crm/api/v1/quotations'
export {
  createCustomer,
  findCustomer,
  findCustomerContact,
  getCustomer,
  getCustomerProfile,
  holdCustomerWithin,
  listCustomers,
  updateCustomer,
} from '@/modules/crm/services/customer-service'
export {
  createLead,
  findLeadWithin,
  getLead,
  getStageSummary,
  listLeads,
  listStalledLeads,
  listTeam,
  moveLead,
  updateLead,
} from '@/modules/crm/services/lead-service'
export {
  acceptQuotation,
  applyDraftDiscountWithin,
  createQuotation,
  expireQuotation,
  getQuotation,
  listQuotations,
  rejectQuotation,
  sendQuotation,
  updateQuotation,
} from '@/modules/crm/services/quotation-service'
export type { DraftDiscount } from '@/modules/crm/services/quotation-service'
export { convertQuotation } from '@/modules/crm/services/conversion-service'
export { publishCrmEvents } from '@/modules/crm/events'
export type * from '@/modules/crm/events'
export type * from '@/modules/crm/domain/types'
