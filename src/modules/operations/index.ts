export {
  createContractHandler,
  createDocumentHandler,
  createTicketHandler,
  listContractsHandler,
  listDocumentsHandler,
  listTicketsHandler,
  updateContractHandler,
  updateTicketHandler,
} from '@/modules/operations/api/v1/operations'
export { createContract, createDocument, createTicket, listContracts, listDocuments, listTickets, updateContract, updateTicket } from '@/modules/operations/services/operations-service'
export type * from '@/modules/operations/domain/types'
