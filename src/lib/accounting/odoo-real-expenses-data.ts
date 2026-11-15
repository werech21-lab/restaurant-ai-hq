/**
 * odoo-real-expenses-data.ts
 * ==============================================================================
 * Venture Foods W.L.L. — Petty Cash & HR Expense Types
 * All static custodian balances, static cheques, and hardcoded historical
 * expense sheets have been purged. Petty cash / hr.expense is unlinked until
 * connected to live Odoo hr.expense queries.
 * ==============================================================================
 */

export interface OdooExpenseCategory {
  rank: number
  id: string
  nameAr: string
  nameEn: string
  tagAr: string
  tagEn: string
  accountCode: string
  txCount: number
  amountKwd: number
  pct: number
}

export interface OdooCustodian {
  id: string
  nameAr: string
  nameEn: string
  roleAr: string
  roleEn: string
  txCount: number
  totalKwd: number
  pct: number
  accountCode: string
  statusAr: string
  statusEn: string
}

export interface OdooDetailedTransaction {
  id: string
  date: string
  custodianAr: string
  custodianEn: string
  badgeId?: string
  employeeNameAr?: string
  employeeNameEn?: string
  descAr: string
  descEn: string
  categoryAr: string
  categoryEn: string
  costCenterAr: string
  costCenterEn: string
  brandAr: string
  brandEn: string
  branchAr: string
  branchEn: string
  accountCode: string
  amountKwd: number
  docRef: string
  statusAr: string
  statusEn: string
}

export const ODOO_EXPENSES_TOTAL_KWD = 0
export const ODOO_EXPENSES_TOTAL_TX = 0

export const ODOO_SETTLEMENT_METRICS = {
  txCount365: 0,
  pendingUploadKwd: 0,
  pendingApprovalKwd: 0,
  payableChequesKwd: 0,
}

export interface OdooTopLicenseTx {
  id: string
  date: string
  descAr: string
  descEn: string
  beneficiaryAr: string
  beneficiaryEn: string
  custodianAr: string
  custodianEn: string
  branchAr: string
  branchEn: string
  brandAr: string
  brandEn: string
  accountCode: string
  amountKwd: number
  docRef: string
  categoryAr: string
  categoryEn: string
  statusAr: string
  statusEn: string
}

export const ODOO_EXPENSE_CATEGORIES_25: OdooExpenseCategory[] = []
export const ODOO_CUSTODIANS_7: OdooCustodian[] = []
export const ODOO_CUSTODIANS_ALL: OdooCustodian[] = []
export const ODOO_SANAD_STATEMENT_DETAILS: OdooDetailedTransaction[] = []
export const ODOO_RABIH_MAINTENANCE_DETAILS: OdooDetailedTransaction[] = []
export const ODOO_TOP_SANAD_LICENSES_TRANSACTIONS: OdooTopLicenseTx[] = []

export type AdminApprovalStatus = 'approved' | 'submitted'
export type ExpensePaymentStatus = 'not_paid' | 'in_settlement' | 'paid'

export interface OdooExpenseSheetReport {
  id: string
  reportNo: string
  date: string
  custodianId: string
  custodianNameAr: string
  custodianNameEn: string
  titleAr: string
  titleEn: string
  descriptionAr: string
  descriptionEn: string
  costCenterAr: string
  costCenterEn: string
  brandAr: string
  brandEn: string
  amountKwd: number
  accountCode: string
  adminApproval: AdminApprovalStatus
  paymentStatus: ExpensePaymentStatus
  paymentChequeRef?: string
  paymentDate?: string
  payingBankAr?: string
  payingBankEn?: string
}

export interface OdooExpenseSheetCustodianFilter {
  id: string
  nameAr: string
  nameEn: string
  totalKwd: number
  sheetsCount: number
}

export const ODOO_EXPENSE_SHEET_CUSTODIANS: OdooExpenseSheetCustodianFilter[] = []
export const ODOO_REAL_EXPENSE_SHEETS: OdooExpenseSheetReport[] = []
