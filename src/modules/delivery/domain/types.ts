export type DeliveryPartner = {
  id: string
  code: string
  name: string
  commissionBps: number
}

export type DeliveryOrder = {
  id: string
  partnerId: string
  partnerName: string
  orderedOn: string
  grossMinor: number
  commissionMinor: number
  status: 'recorded' | 'cancelled'
  settled: boolean
  createdAt: string
}

export type DeliverySettlement = {
  id: string
  orderId: string
  settledOn: string
  commissionMinor: number
  journalEntryId: string | null
}
