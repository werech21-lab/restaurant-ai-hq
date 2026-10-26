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
  getCustomer,
  getCustomerProfile,
  listCustomers,
  updateCustomer,
} from '@/modules/crm/services/customer-service'
export {
  createLead,
  getLead,
  getStageSummary,
  listLeads,
  listTeam,
  moveLead,
  updateLead,
} from '@/modules/crm/services/lead-service'
export {
  acceptQuotation,
  createQuotation,
  expireQuotation,
  getQuotation,
  listQuotations,
  rejectQuotation,
  sendQuotation,
  updateQuotation,
} from '@/modules/crm/services/quotation-service'
export { convertQuotation } from '@/modules/crm/services/conversion-service'
export type * from '@/modules/crm/events'
export type * from '@/modules/crm/domain/types'
