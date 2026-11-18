/**
 * Venture Foods Restaurant Management W.L.L. — HRMS & Kuwait Labor Law No. 6/2010 Types & Calculators.
 *
 * All static sample candidate pipelines, PAM quotas, shift rosters, loans, and housing flats
 * have been purged. Only pure statutory formulas (`calculateKuwaitEosb`) and type interfaces remain.
 */

export type HrCommandTabKey =
  | 'employees'
  | 'payroll'
  | 'planningGantt'
  | 'expensesCustody'
  | 'recruitment'
  | 'residency'
  | 'leaves'
  | 'attendance'
  | 'loans'
  | 'housing'
  | 'eosb'
  | 'letters'
  | 'reports'

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

export type PamBranchQuota = {
  licenseCode: string
  brandAr: string
  brandEn: string
  branchAr: string
  branchEn: string
  pamFileNumber: string
  allowedCeiling: number
  registeredCount: number
  openOverseasVisas: number
}

export type OverseasStage =
  | 'REQUISITION'
  | 'INTERVIEW_TEST'
  | 'VISA_18_ISSUED'
  | 'GAMCA_EMBASSY'
  | 'FLIGHT_BOOKED'
  | 'KUWAIT_BIOMETRICS_MUNICIPALITY'
  | 'CIVIL_ID_DEPLOYED'

export type OverseasCandidate = {
  id: string
  refCode: string
  fullNameEn: string
  fullNameAr: string
  nationalityEn: string
  nationalityAr: string
  passportNo: string
  roleEn: string
  roleAr: string
  brandEn: string
  brandAr: string
  branchEn: string
  branchAr: string
  stage: OverseasStage
  visa18Number: string
  arrivalEta: string
  agencyFeeKwd: number
  visaFeeKwd: number
  medicalAndCardKwd: number
  flightTicketKwd: number
  offeredBasicKwd: number
}

export type MandoubTask = {
  id: string
  txCode: string
  employeeCode: string
  employeeNameEn: string
  employeeNameAr: string
  authorityEn: 'PAM / Asahal' | 'MOI Residency Affairs' | 'Kuwait Municipality' | 'PACI Civil ID' | 'Traffic Dept'
  authorityAr: 'أسهل / القوى العاملة' | 'شؤون الإقامة' | 'بلدية الكويت' | 'البطاقة المدنية PACI' | 'المرور'
  taskEn: string
  taskAr: string
  status: 'IN_PROGRESS' | 'SUBMITTED' | 'READY_FOR_COLLECTION' | 'COMPLETED'
  govFeeKwd: number
  dueDate: string
  assignedPro: string
}

export type LeaveVacationRecord = {
  id: string
  employeeCode: string
  employeeNameEn: string
  employeeNameAr: string
  brandEn: string
  brandAr: string
  leaveType: 'ANNUAL' | 'SICK_KUWAIT_LAW' | 'EMERGENCY' | 'MATERNITY' | 'HAJJ' | 'UNPAID'
  annualBalanceDays: number
  requestedDays: number
  departureDate: string
  expectedReturnDate: string
  destinationEn: string
  destinationAr: string
  ticketBooked: boolean
  ticketCostKwd: number
  airlineRef: string
  status: 'APPROVED' | 'ON_VACATION' | 'RETURNED' | 'PENDING'
}

export type ShiftRosterRow = {
  id: string
  employeeCode: string
  employeeNameEn: string
  employeeNameAr: string
  branchEn: string
  branchAr: string
  shiftCode: 'MORNING_A' | 'EVENING_B' | 'SPLIT_KITCHEN' | 'NIGHT_CLOSING'
  shiftTime: string
  date: string
  checkIn: string
  checkOut: string
  regularHours: number
  overtimeHours: number
  overtimeMultiplier: 1.25 | 1.5 | 2.0
  overtimePayKwd: number
  approved: boolean
}

export type LoanAndDisciplinaryRow = {
  id: string
  employeeCode: string
  employeeNameEn: string
  employeeNameAr: string
  branchEn: string
  branchAr: string
  recordType: 'LOAN_ADVANCE' | 'DISCIPLINARY_ACTION'
  titleEn: string
  titleAr: string
  totalLoanKwd: number
  monthlyInstallmentKwd: number
  remainingBalanceKwd: number
  penaltyDaysDeducted: number
  penaltyAmountKwd: number
  date: string
  status: 'ACTIVE' | 'DEDUCTING' | 'CLOSED'
}

export type StaffHousingFlat = {
  id: string
  flatCode: string
  areaEn: string
  areaAr: string
  buildingEn: string
  buildingAr: string
  flatNumber: string
  capacity: number
  occupiedCount: number
  occupantsEn: string[]
  occupantsAr: string[]
  monthlyRentKwd: number
  leaseExpiryDate: string
  busRouteEn: string
  busRouteAr: string
  driverNameEn: string
  driverNameAr: string
}

export const OVERSEAS_STAGES: Array<{
  key: OverseasStage
  step: number
  ar: string
  en: string
  badgeColor: string
}> = [
  {
    key: 'REQUISITION',
    step: 1,
    ar: '1. طلب احتياج من الفرع/المطبخ',
    en: '1. Branch/Kitchen Requisition',
    badgeColor: 'border-slate-500/40 bg-slate-800/60 text-slate-200',
  },
  {
    key: 'INTERVIEW_TEST',
    step: 2,
    ar: '2. المقابلة وتجربة الطبخ',
    en: '2. Interview & Trade Test',
    badgeColor: 'border-sky-500/40 bg-sky-950/50 text-sky-200',
  },
  {
    key: 'VISA_18_ISSUED',
    step: 3,
    ar: '3. إصدار إذن العمل وفيزا 18',
    en: '3. PAM Work Permit & Visa 18 Issued',
    badgeColor: 'border-indigo-500/40 bg-indigo-950/50 text-indigo-200',
  },
  {
    key: 'GAMCA_EMBASSY',
    step: 4,
    ar: '4. الفحص الطبي ببلد المنشأ والتصديق',
    en: '4. GAMCA Medical & Embassy Stamping',
    badgeColor: 'border-purple-500/40 bg-purple-950/50 text-purple-200',
  },
  {
    key: 'FLIGHT_BOOKED',
    step: 5,
    ar: '5. تذكرة الطيران وموعد الوصول للكويت',
    en: '5. Flight Booked & Kuwait Arrival ETA',
    badgeColor: 'border-amber-500/40 bg-amber-950/50 text-amber-200',
  },
  {
    key: 'KUWAIT_BIOMETRICS_MUNICIPALITY',
    step: 6,
    ar: '6. البصمات والفحص المحلي وكرت البلدية',
    en: '6. Kuwait Medical, Fingerprints & Municipality Card',
    badgeColor: 'border-teal-500/40 bg-teal-950/50 text-teal-200',
  },
  {
    key: 'CIVIL_ID_DEPLOYED',
    step: 7,
    ar: '7. إصدار البطاقة المدنية ومباشرة العمل',
    en: '7. Civil ID Issued & Branch Deployed',
    badgeColor: 'border-emerald-500/40 bg-emerald-950/50 text-emerald-200',
  },
]

export const PAM_QUOTA_LIST: PamBranchQuota[] = []
export const INITIAL_OVERSEAS_CANDIDATES: OverseasCandidate[] = []
export const MANDOUB_PRO_QUEUE: MandoubTask[] = []
export const LEAVE_VACATION_RECORDS: LeaveVacationRecord[] = []
export const SHIFT_ROSTER_RECORDS: ShiftRosterRow[] = []
export const LOANS_AND_DISCIPLINARY_RECORDS: LoanAndDisciplinaryRow[] = []
export const STAFF_HOUSING_FLATS: StaffHousingFlat[] = []

export type KuwaitEosbInput = {
  hireDate: string
  lastWorkingDate: string
  basicSalaryKwd: number
  allowancesKwd: number
  reason: 'RESIGNATION' | 'TERMINATION' | 'CONTRACT_EXPIRY'
  unusedLeaveDays: number
  workedDaysInFinalMonth: number
  outstandingLoanKwd: number
}

export type KuwaitEosbResult = {
  years: number
  months: number
  days: number
  totalServiceYearsDecimal: number
  remunerationBaseKwd: number
  dailyWage26Kwd: number
  dailyWage30Kwd: number
  firstFiveYearsIndemnityKwd: number
  afterFiveYearsIndemnityKwd: number
  grossFullIndemnityKwd: number
  resignationEntitlementRatio: number
  resignationEntitlementLabelEn: string
  resignationEntitlementLabelAr: string
  netIndemnityPayableKwd: number
  leaveEncashmentKwd: number
  finalMonthSalaryKwd: number
  outstandingLoanKwd: number
  finalSettlementNetKwd: number
}

export function calculateKuwaitEosb(input: KuwaitEosbInput): KuwaitEosbResult {
  const start = new Date(input.hireDate)
  const end = new Date(input.lastWorkingDate)
  const diffMs = Math.max(0, end.getTime() - start.getTime())
  const totalDays = Math.floor(diffMs / 86_400_000)

  const years = Math.floor(totalDays / 365)
  const remAfterYears = totalDays - years * 365
  const months = Math.floor(remAfterYears / 30)
  const days = remAfterYears - months * 30
  const totalServiceYearsDecimal = Math.round((totalDays / 365) * 1000) / 1000

  const remunerationBaseKwd = Math.max(
    0,
    Number(input.basicSalaryKwd || 0) + Number(input.allowancesKwd || 0),
  )
  const dailyWage26Kwd = remunerationBaseKwd / 26
  const dailyWage30Kwd = remunerationBaseKwd / 30

  const firstFiveYears = Math.min(5, totalServiceYearsDecimal)
  const afterFiveYears = Math.max(0, totalServiceYearsDecimal - 5)

  const firstFiveYearsIndemnityKwd = firstFiveYears * 15 * dailyWage26Kwd
  const afterFiveYearsIndemnityKwd = afterFiveYears * 30 * dailyWage26Kwd
  const rawGrossIndemnity = firstFiveYearsIndemnityKwd + afterFiveYearsIndemnityKwd
  const grossFullIndemnityKwd = Math.min(rawGrossIndemnity, remunerationBaseKwd * 18)

  let ratio = 1
  let labelEn = '100% Full Entitlement (Termination / Contract Expiry — Art. 51)'
  let labelAr = 'استحقاق كامل 100% (إنهاء خدمات / انتهاء عقد — مادة 51)'

  if (input.reason === 'RESIGNATION') {
    if (totalServiceYearsDecimal < 3) {
      ratio = 0
      labelEn = '0% Entitlement (Resignation under 3 years — Art. 53)'
      labelAr = '0% غير مستحق (استقالة لأقل من 3 سنوات — مادة 53)'
    } else if (totalServiceYearsDecimal < 5) {
      ratio = 0.5
      labelEn = '50% Half Entitlement (Resignation 3 to <5 years — Art. 53)'
      labelAr = '50% نصف المكافأة (استقالة من 3 إلى أقل من 5 سنوات — مادة 53)'
    } else if (totalServiceYearsDecimal < 10) {
      ratio = 2 / 3
      labelEn = '66.67% Two-Thirds Entitlement (Resignation 5 to <10 years — Art. 53)'
      labelAr = '66.67% ثلثا المكافأة (استقالة من 5 إلى أقل من 10 سنوات — مادة 53)'
    } else {
      ratio = 1
      labelEn = '100% Full Entitlement (Resignation 10+ years — Art. 53)'
      labelAr = '100% المكافأة الكاملة (استقالة بعد 10 سنوات فأكثر — مادة 53)'
    }
  }

  const netIndemnityPayableKwd = grossFullIndemnityKwd * ratio
  const leaveEncashmentKwd = Math.max(0, Number(input.unusedLeaveDays || 0)) * dailyWage26Kwd
  const finalMonthSalaryKwd = Math.max(0, Number(input.workedDaysInFinalMonth || 0)) * dailyWage30Kwd
  const outstandingLoanKwd = Math.max(0, Number(input.outstandingLoanKwd || 0))

  const finalSettlementNetKwd = Math.max(
    0,
    netIndemnityPayableKwd + leaveEncashmentKwd + finalMonthSalaryKwd - outstandingLoanKwd,
  )

  const round3 = (n: number) => Math.round(n * 1000) / 1000

  return {
    years,
    months,
    days,
    totalServiceYearsDecimal,
    remunerationBaseKwd: round3(remunerationBaseKwd),
    dailyWage26Kwd: round3(dailyWage26Kwd),
    dailyWage30Kwd: round3(dailyWage30Kwd),
    firstFiveYearsIndemnityKwd: round3(firstFiveYearsIndemnityKwd),
    afterFiveYearsIndemnityKwd: round3(afterFiveYearsIndemnityKwd),
    grossFullIndemnityKwd: round3(grossFullIndemnityKwd),
    resignationEntitlementRatio: Math.round(ratio * 10000) / 100,
    resignationEntitlementLabelEn: labelEn,
    resignationEntitlementLabelAr: labelAr,
    netIndemnityPayableKwd: round3(netIndemnityPayableKwd),
    leaveEncashmentKwd: round3(leaveEncashmentKwd),
    finalMonthSalaryKwd: round3(finalMonthSalaryKwd),
    outstandingLoanKwd: round3(outstandingLoanKwd),
    finalSettlementNetKwd: round3(finalSettlementNetKwd),
  }
}

export type ExecutiveHrReportMeta = {
  id: number
  code: string
  titleAr: string
  titleEn: string
  subtitleAr: string
  subtitleEn: string
  badge: string
}

export const EXECUTIVE_12_HR_REPORTS: ExecutiveHrReportMeta[] = []
