export type Employee = {
  id: string
  employeeCode: string
  fullName: string
  roleTitle: string
  department: string
  departmentRoot: string | null
  badgeCode: string | null
  workEmail: string | null
  workPhone: string | null
  mobilePhone: string | null
  workLocation: string | null
  odooId: number | null
  hasRunningContract: boolean
  avatarInitials: string | null
  branchId: string | null
  basicSalaryMinor: number
  allowancesMinor: number
  residencyExpiry: string | null
  status: 'active' | 'inactive'
  version: number
}

export type HrContract = {
  id: string
  employeeId: string
  name: string
  dateStart: string
  dateEnd: string | null
  wageMinor: number
  state: 'draft' | 'open' | 'close' | 'cancel'
}

export type HrCustody = {
  id: string
  employeeId: string
  itemName: string
  serialOrRef: string
  issuedOn: string
  returnedOn: string | null
  status: 'open' | 'returned' | 'lost'
  notesAr: string
}

export type HrLoan = {
  id: string
  employeeId: string
  principalMinor: number
  remainingMinor: number
  installmentMinor: number
  startDate: string
  status: 'active' | 'settled' | 'cancelled'
  notesAr: string
}

export type HrOvertime = {
  id: string
  employeeId: string
  workDate: string
  minutes: number
  amountMinor: number
  status: 'draft' | 'approved' | 'paid' | 'rejected'
  notesAr: string
}

export type HrDocument = {
  id: string
  employeeId: string
  docType: 'contract' | 'civil_id' | 'passport' | 'residency' | 'certificate' | 'other'
  title: string
  issuedOn: string | null
  expiresOn: string | null
  status: 'valid' | 'expired' | 'missing'
  notesAr: string
}

export type Employee360 = {
  employee: Employee
  contracts: HrContract[]
  payslips: Payslip[]
  attendance: Attendance[]
  leaves: Leave[]
  custody: HrCustody[]
  loans: HrLoan[]
  overtimes: HrOvertime[]
  documents: HrDocument[]
}

export type PayrollDashboard = {
  warnings: {
    withoutRunningContracts: number
    missingFromOpenBatches: number
    conflicts: number
    newContracts: number
    timeOffToDefer: number
    timeOffWithoutJoinedDocument: number
  }
  batches: Array<{
    period: string
    label: string
    status: 'new' | 'done'
    payslipCount: number
    generateTarget: number
  }>
  employerCostMonthlyMinor: number
  employerCostAnnualMinor: number
  trends: {
    newEmployees: number
    lastDepartures: number
    bars: Array<{ month: string; hires: number; departures: number }>
  }
}

export type Shift = {
  id: string
  branchId: string | null
  name: string
  weekday: number
  startsAt: string
  endsAt: string
}

export type Attendance = {
  id: string
  employeeId: string
  employeeName: string
  branchId: string | null
  checkIn: string
  checkOut: string | null
  overtimeMinutes: number
}

export type Leave = {
  id: string
  employeeId: string
  employeeName: string
  leaveType: 'annual' | 'sick' | 'unpaid'
  startDate: string
  endDate: string
  days: number
  approvalStatus: 'pending' | 'approved' | 'rejected'
  version: number
}

export type PayrollRun = {
  id: string
  period: string
  grossMinor: number
  deductionsMinor: number
  netMinor: number
  journalEntryId: string | null
  status: 'draft' | 'posted'
}

export type Payslip = {
  id: string
  runId: string
  employeeId: string
  employeeName: string
  period: string
  grossMinor: number
  deductionsMinor: number
  netMinor: number
  journalEntryId: string | null
  status: 'draft' | 'posted'
}

export type Appraisal = {
  id: string
  employeeId: string
  employeeName: string
  rating: number
  kpiScore: number
  reviewerNotes: string
}

export type Appointment = {
  id: string
  requestCode: string
  employeeName: string
  branchId: string | null
  requestType: string
  actionDirection: string
  appointmentDate: string
  appointmentTimeSlot: string
  hqCounterOrOfficer: string
  status: 'booked' | 'confirmed' | 'completed_handover' | 'missed_appointment'
  notesAr: string
  version: number
}

export type EmployeeExpense = {
  id: string
  employeeId: string
  employeeName: string
  category: string
  amountMinor: number
  approvalStatus: 'pending' | 'approved' | 'rejected'
  journalEntryId: string | null
  version: number
}
