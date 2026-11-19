/**
 * Venture Foods Restaurant Management W.L.L. — Employee Directory Types
 *
 * All static invented employee records, hardcoded salaries, and static leave balances
 * (`24.71`, `166`, etc.) have been purged. Real workforce figures must be fetched
 * from Odoo (`hr.employee`) or database records. A view with no workforce source is omitted.
 */

export type VentureEmployee = {
  id: string
  code: string
  nameAr: string
  nameEn: string
  jobTitleAr: string
  jobTitleEn: string
  department: string
  departmentAr: string
  workLocation: string
  workLocationAr: string
  phone: string
  mobile: string
  email: string
  civilId: string
  civilIdExpiry: string
  workPermitExpiry: string
  residencyExpiry: string
  healthCardExpiry: string
  passportNo: string
  passportExpiry: string
  nationalityAr: string
  nationalityEn: string
  flag: string
  basicSalary: number
  allowances: number
  deductions: number
  netSalary: number
  pamSalary: number
  pamFileNumber: string
  pamSponsor: string
  pamDesignationAr: string
  pamId: string
  bankName: string
  bankNameAr: string
  bankAccount: string
  iban: string
  status: 'ACTIVE' | 'ON_VACATION'
  hireDate: string
  contractType: string
  managerNameAr: string
  managerNameEn: string
  workingHours: string
  leaves: { balance: number; taken: number; total: number }
  loans: number
  custodyCount: number
  custodyItems: Array<{
    nameAr: string
    nameEn: string
    tag: string
    date: string
  }>
  documents: Array<{
    id: string
    nameAr: string
    nameEn: string
    type: string
    fileName: string
    uploadDate: string
    statusAr: string
    statusEn: string
    size: string
  }>
  auditLog: Array<{
    date: string
    actionAr: string
    actionEn: string
    user: string
  }>
}

export type VentureDepartmentMeta = {
  key: string
  en: string
  ar: string
  count: number
}

export type VentureLocationMeta = {
  key: string
  en: string
  ar: string
  count: number
}

export const VENTURE_DEPARTMENTS: VentureDepartmentMeta[] = []
export const VENTURE_WORK_LOCATIONS: VentureLocationMeta[] = []
export const VENTURE_EMPLOYEES: VentureEmployee[] = []
