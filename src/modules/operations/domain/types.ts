export type Contract = {
  id: string
  title: string
  counterparty: string
  startDate: string
  endDate: string
  valueMinor: number
  renewalAlertDays: number
  status: 'active' | 'ended'
  renewalDue: boolean
  version: number
}

export type EnterpriseDocument = {
  id: string
  contractId: string | null
  title: string
  category: string
  issuedOn: string
}

export type QualityTicket = {
  id: string
  type: 'quality_inspection' | 'equipment_maintenance'
  branchId: string | null
  assetName: string
  severity: 'low' | 'medium' | 'high'
  costMinor: number
  status: 'open' | 'in_progress' | 'closed'
  version: number
}
