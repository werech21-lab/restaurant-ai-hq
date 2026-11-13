export type ExecSessionRole = 'admin' | 'gm' | 'dgm' | 'auditor'

export type ExecApproverRole = 'admin' | 'gm' | 'dgm'

export interface ExecRoleProfile {
  role: ExecSessionRole
  nameAr: string
  nameEn: string
  titleAr: string
  titleEn: string
  accountLabelAr: string
  accountLabelEn: string
  approverRoleAr: string
  approverRoleEn: string
  sealAuthorityAr: string
  sealAuthorityEn: string
  canApprove: boolean
  isAuditor: boolean
}

export const EXEC_ROLE_PROFILES: Record<ExecSessionRole, ExecRoleProfile> = {
  admin: {
    role: 'admin',
    nameAr: 'عبدالله عويرة',
    nameEn: 'Abdullah Awirah',
    titleAr: 'مسؤول النظام والسكرتير التنفيذي',
    titleEn: 'System Admin & Executive Secretary',
    accountLabelAr: 'عبدالله عويرة • مسؤول النظام',
    accountLabelEn: 'Abdullah Awirah • System Admin',
    approverRoleAr: 'مسؤول النظام',
    approverRoleEn: 'System Admin',
    sealAuthorityAr: 'عبدالله عويرة • مسؤول النظام (ختم رقمي موثق)',
    sealAuthorityEn: 'Abdullah Awirah • System Admin (Verified Digital Seal)',
    canApprove: true,
    isAuditor: false,
  },
  gm: {
    role: 'gm',
    nameAr: 'المدير العام',
    nameEn: 'General Manager',
    titleAr: 'المدير العام',
    titleEn: 'General Manager',
    accountLabelAr: 'المدير العام',
    accountLabelEn: 'General Manager',
    approverRoleAr: 'المدير العام',
    approverRoleEn: 'General Manager',
    sealAuthorityAr: 'المدير العام (ختم رقمي موثق)',
    sealAuthorityEn: 'General Manager (Verified Digital Seal)',
    canApprove: true,
    isAuditor: false,
  },
  dgm: {
    role: 'dgm',
    nameAr: 'نائب المدير العام',
    nameEn: 'Deputy General Manager',
    titleAr: 'نائب المدير العام',
    titleEn: 'Deputy General Manager',
    accountLabelAr: 'نائب المدير العام',
    accountLabelEn: 'Deputy General Manager',
    approverRoleAr: 'نائب المدير العام',
    approverRoleEn: 'Deputy General Manager',
    sealAuthorityAr: 'نائب المدير العام (ختم رقمي موثق)',
    sealAuthorityEn: 'Deputy General Manager (Verified Digital Seal)',
    canApprove: true,
    isAuditor: false,
  },
  auditor: {
    role: 'auditor',
    nameAr: 'مراجع خارجي',
    nameEn: 'External Auditor',
    titleAr: 'مراجع — قراءة فقط',
    titleEn: 'Read-Only Auditor',
    accountLabelAr: 'مراجع — قراءة فقط',
    accountLabelEn: 'Read-Only Auditor',
    approverRoleAr: 'مراجع — قراءة فقط',
    approverRoleEn: 'Read-Only Auditor',
    sealAuthorityAr: 'مراجع — قراءة فقط',
    sealAuthorityEn: 'Read-Only Auditor',
    canApprove: false,
    isAuditor: true,
  },
}

export function normalizeExecSessionRole(raw: unknown): ExecSessionRole | null {
  if (raw === 'admin' || raw === 'executive' || raw === 'exec_admin') {
    return 'admin'
  }
  if (raw === 'gm') return 'gm'
  if (raw === 'dgm') return 'dgm'
  if (raw === 'auditor') return 'auditor'
  return null
}

export function resolveExecRoleProfile(rawRole?: unknown): ExecRoleProfile {
  const normalized = normalizeExecSessionRole(rawRole) ?? 'admin'
  return EXEC_ROLE_PROFILES[normalized]
}

export function toExecApproverRole(rawRole?: unknown): ExecApproverRole {
  const normalized = normalizeExecSessionRole(rawRole)
  if (normalized === 'gm' || normalized === 'dgm') return normalized
  return 'admin'
}
