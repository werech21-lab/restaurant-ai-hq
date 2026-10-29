export type Employee = {
  id: string
  employeeCode: string
  fullName: string
  roleTitle: string
  department: string
  branchId: string | null
  basicSalaryMinor: number
  allowancesMinor: number
  residencyExpiry: string | null
  status: 'active' | 'inactive'
  version: number
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
