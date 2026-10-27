export const orgStatuses = ['active', 'inactive'] as const
export type OrgStatus = (typeof orgStatuses)[number]

export type Brand = {
  id: string
  code: string
  name: string
  status: OrgStatus
  branchCount: number
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export type Branch = {
  id: string
  brandId: string
  brandName: string
  code: string
  name: string
  timezone: string
  status: OrgStatus
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}