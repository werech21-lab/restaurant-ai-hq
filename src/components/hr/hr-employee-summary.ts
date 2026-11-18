export type HrEmployeeSummary = {
  id: string
  code: string
  name: string
  jobTitle: string
  department: string
  phone: string | null
  basicSalary: number
  allowances: number
  deductions: number
  status: string
  hireDate: string
  civilId: string | null
  iban: string | null
  bankName: string | null
  civilIdExpiry: string | null
  passportExpiry: string | null
  healthCardExpiry: string | null
  workPermitExpiry: string | null
  drivingLicenseExpiry: string | null
}
