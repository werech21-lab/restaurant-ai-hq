import type { SuiteApp } from '@/modules/suite/domain/apps'

export type SuiteRecord = {
  id: string
  appKey: SuiteApp
  title: string
  stage: string
  brandName: string
  branchName: string
  department: string
  assignee: string
  amountMinor: number
  startsOn: string | null
  endsOn: string | null
  sortOrder: number
  version: number
  createdAt: string
  updatedAt: string
}

export type SuiteFacet = { key: string; label: string; count: number }

export type SuiteBoard = {
  app: SuiteApp
  stages: readonly string[]
  records: SuiteRecord[]
  facets: {
    department: SuiteFacet[]
    location: SuiteFacet[]
    brand: SuiteFacet[]
  }
}
