import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/hr',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

import { AuditLogView } from '@/app/(panel)/audit/audit-view'
import { ComplianceRadarClient } from '@/app/(panel)/hr/compliance-radar/radar-client'
import { HrForms } from '@/app/(panel)/hr/hr-forms'
import { SmartFolderUploadClient } from '@/app/(panel)/hr/smart-folder-upload/upload-client'
import { EssPortalClient, type EssProfile } from '@/app/ess/ess-client'
import { SmartDepartmentFolderUpload } from '@/components/SmartDepartmentFolderUpload'
import { HrDigitalDossier } from '@/components/hr-digital-dossier'
import { HrWpsToolbar } from '@/components/hr-wps-toolbar'
import { EnterpriseHrCommandHub, type HrAttendanceRow, type HrPayrollRow } from '@/components/hr/EnterpriseHrCommandHub'
import type { HrEmployeeSummary } from '@/components/hr/hr-employee-summary'
import { NewEmployeeWizardModal } from '@/components/hr/NewEmployeeWizardModal'
import { calculateKuwaitEosb } from '@/components/hr/hr-enterprise-data'
import { LanguageProvider } from '@/lib/i18n'
import { SMART_INGEST_MODULES } from '@/lib/smart-ingest-modules'

const el = React.createElement

const TypedLangProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLocale(locale: 'ar' | 'en', node: React.ReactElement): string {
  return renderToStaticMarkup(el(TypedLangProvider, { initialLocale: locale }, node))
}

const SAMPLE_EMPLOYEES: HrEmployeeSummary[] = [
  {
    id: 'emp-1',
    code: '2090',
    name: 'Anand Rao',
    jobTitle: 'Chef de Partie',
    department: 'China Garden · Salmiya Branch',
    phone: '+965 97386402',
    basicSalary: 320.5,
    allowances: 45.25,
    deductions: 15.0,
    status: 'ACTIVE',
    hireDate: '2023-05-10',
    civilId: '291010100123',
    iban: 'KW81NBOK0000000000001000000001',
    bankName: 'National Bank of Kuwait (NBK)',
    civilIdExpiry: '2027-06-15',
    passportExpiry: null,
    healthCardExpiry: '2026-12-20',
    workPermitExpiry: null,
    drivingLicenseExpiry: null,
  },
  {
    id: 'emp-excluded',
    code: '9999',
    name: 'Heisenberg Test Staff',
    jobTitle: 'Legacy',
    department: 'Al-Qurain Kitchen',
    phone: null,
    basicSalary: 500,
    allowances: 0,
    deductions: 0,
    status: 'ACTIVE',
    hireDate: '2022-01-01',
    civilId: null,
    iban: null,
    bankName: null,
    civilIdExpiry: null,
    passportExpiry: null,
    healthCardExpiry: null,
    workPermitExpiry: null,
    drivingLicenseExpiry: null,
  },
]

const SAMPLE_PAYROLL: HrPayrollRow[] = [
  {
    id: 'pay-1',
    month: 11,
    year: 2026,
    employeeId: 'emp-1',
    employeeCode: '2090',
    employeeName: 'Anand Rao',
    department: 'China Garden · Salmiya Branch',
    basicSalary: 320.5,
    totalAllowances: 45.25,
    totalDeductions: 15.0,
    netSalary: 350.75,
    absentDays: 0,
    lateDays: 1,
    status: 'DRAFT',
  },
]

const SAMPLE_ATTENDANCE: HrAttendanceRow[] = [
  {
    id: 'att-1',
    employeeCode: '2090',
    employeeName: 'Anand Rao',
    date: '2026-11-15',
    status: 'PRESENT',
    hoursWorked: 8.5,
  },
]

describe('Wave 3B Tier 2 — (panel) HR, Compliance Radar, Smart Folder Upload, Smart Ingest, Audit & /ess', () => {
  describe('1. /hr — EnterpriseHrCommandHub, Wizard, Dossier, WPS & Forms', () => {
    it('renders calm empty states and unavailable KPI dashes in both AR (rtl) and EN (ltr)', () => {
      const arHtml = renderWithLocale(
        'ar',
        el(EnterpriseHrCommandHub, {
          locale: 'ar',
          employees: [],
          payrollRows: [],
          attendanceRows: [],
          year: 2026,
          month: 11,
          canCreate: true,
          canEdit: true,
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('لا يوجد موظفون في هذه القائمة')
      expect(arHtml).toContain('data-state-block="empty"')
      expect(arHtml).not.toContain('غير مربوط بمصدر')
      expect(arHtml).toContain('title="غير متاح"')
      expect(arHtml).toContain('data-unavailable="true"')
      expect(arHtml).toContain('role="tablist"')

      const enHtml = renderWithLocale(
        'en',
        el(EnterpriseHrCommandHub, {
          locale: 'en',
          employees: [],
          payrollRows: [],
          attendanceRows: [],
          year: 2026,
          month: 11,
          canCreate: false,
          canEdit: false,
        }),
      )
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('No employees in this directory')
      expect(enHtml).toContain('data-state-block="empty"')
      expect(enHtml).not.toContain('Not Linked to a Source')
      expect(enHtml).toContain('title="Unavailable"')
      expect(enHtml).not.toContain('موظف جديد')
    })

    it('formats 3-decimal KWD, Kuwait dates, excludes Heisenberg/Qurain, and renders payroll/attendance/eosb tabs', () => {
      const empHtml = renderWithLocale(
        'en',
        el(EnterpriseHrCommandHub, {
          locale: 'en',
          initialTab: 'employees',
          employees: SAMPLE_EMPLOYEES,
          payrollRows: SAMPLE_PAYROLL,
          attendanceRows: SAMPLE_ATTENDANCE,
          year: 2026,
          month: 11,
          canCreate: true,
          canEdit: true,
        }),
      )
      expect(empHtml).toContain('Anand Rao')
      expect(empHtml).toContain('350.750 KWD')
      expect(empHtml).toContain('2023-05-10')
      expect(empHtml).not.toContain('Heisenberg')
      expect(empHtml).not.toContain('Qurain')

      const payrollArHtml = renderWithLocale(
        'ar',
        el(EnterpriseHrCommandHub, {
          locale: 'ar',
          initialTab: 'payroll',
          employees: SAMPLE_EMPLOYEES,
          payrollRows: SAMPLE_PAYROLL,
          attendanceRows: SAMPLE_ATTENDANCE,
          year: 2026,
          month: 11,
          canCreate: true,
          canEdit: true,
        }),
      )
      expect(payrollArHtml).toContain('350.750 د.ك')
      expect(payrollArHtml).toContain('NBK WPS')
      expect(payrollArHtml).toContain('/hr/payroll/pay-1/print')

      const attendanceEnHtml = renderWithLocale(
        'en',
        el(EnterpriseHrCommandHub, {
          locale: 'en',
          initialTab: 'attendance',
          employees: SAMPLE_EMPLOYEES,
          payrollRows: SAMPLE_PAYROLL,
          attendanceRows: SAMPLE_ATTENDANCE,
          year: 2026,
          month: 11,
          canCreate: false,
          canEdit: false,
        }),
      )
      expect(attendanceEnHtml).toContain('2026-11-15')
      expect(attendanceEnHtml).toContain('8.50')

      const eosbHtml = renderWithLocale(
        'ar',
        el(EnterpriseHrCommandHub, {
          locale: 'ar',
          initialTab: 'eosb',
          employees: [],
          payrollRows: [],
          attendanceRows: [],
          year: 2026,
          month: 11,
          canCreate: false,
          canEdit: false,
        }),
      )
      expect(eosbHtml).toContain('data-state-block="empty"')

      const eosbCalc = calculateKuwaitEosb({
        hireDate: '2021-01-01',
        lastWorkingDate: '2026-01-01',
        basicSalaryKwd: 260,
        allowancesKwd: 0,
        reason: 'TERMINATION',
        unusedLeaveDays: 0,
        workedDaysInFinalMonth: 0,
        outstandingLoanKwd: 0,
      })
      expect(eosbCalc.netIndemnityPayableKwd).toBeGreaterThan(0)
    })

    it('renders accessible NewEmployeeWizardModal, HrDigitalDossier, HrWpsToolbar, HrExecutiveReportsHub & HrForms', () => {
      const wizardStep1 = renderWithLocale(
        'ar',
        el(NewEmployeeWizardModal, { open: true, onClose: () => {}, en: false }),
      )
      expect(wizardStep1).toContain('role="dialog"')
      expect(wizardStep1).toContain('aria-modal="true"')
      expect(wizardStep1).not.toContain('294051208841')

      const wizardStep3 = renderWithLocale(
        'ar',
        el(NewEmployeeWizardModal, { open: true, onClose: () => {}, en: false, initialStep: 3 }),
      )
      expect(wizardStep3).toContain('0.000 د.ك')
      expect(wizardStep3).not.toContain('KW81NBOK0000000000002007694489')

      const wizardStep4 = renderWithLocale(
        'ar',
        el(NewEmployeeWizardModal, { open: true, onClose: () => {}, en: false, initialStep: 4 }),
      )
      expect(wizardStep4).toContain('للشركة')
      expect(wizardStep4).not.toContain('корпораت')

      const dossierEn = renderWithLocale(
        'en',
        el(HrDigitalDossier, { employeeId: 'emp-1', locale: 'en' }),
      )
      expect(dossierEn).toContain('data-state-block="loading"')

      const wpsAr = renderWithLocale('ar', el(HrWpsToolbar, { month: 11, year: 2026, locale: 'ar' }))
      expect(wpsAr).toContain('dir="rtl"')
      expect(wpsAr).toContain('NBK WPS')

      const formsHtml = renderWithLocale(
        'en',
        el(HrForms, {
          employees: [{ id: 'emp-1', name: 'Anand Rao' }],
          year: 2026,
          month: 11,
          canCreate: true,
          canEdit: true,
          locale: 'en',
        }),
      )
      expect(formsHtml).toContain('Save Employee')
      expect(formsHtml).toContain('Generate Payroll 11/2026')
    })
  })

  describe('2. /hr/compliance-radar — ComplianceRadarClient', () => {
    it('filters excluded entities, renders dynamic GRO contact, Kuwait dates, and empty StateBlock', () => {
      const radarData = {
        totals: { employees: 1, expired: 1, d30: 0, d60: 0, valid: 1, missing: 2 },
        groups: {
          expired: [
            {
              employeeId: 'emp-1',
              code: '2090',
              name: 'Anand Rao',
              jobTitle: 'Chef',
              department: 'Salmiya',
              docKey: 'civilIdExpiry' as const,
              docLabelAr: 'البطاقة المدنية',
              docLabelEn: 'Civil ID',
              expiryDate: '2026-10-01',
              daysLeft: -45,
              band: 'expired' as const,
            },
            {
              employeeId: 'emp-x',
              code: '9999',
              name: 'Jahra Excluded Employee',
              jobTitle: 'Staff',
              department: 'Jahra Branch',
              docKey: 'civilIdExpiry' as const,
              docLabelAr: 'البطاقة المدنية',
              docLabelEn: 'Civil ID',
              expiryDate: '2026-09-01',
              daysLeft: -60,
              band: 'expired' as const,
            },
          ],
          d30: [],
          d60: [],
          valid: [
            {
              employeeId: 'emp-1',
              code: '2090',
              name: 'Anand Rao',
              jobTitle: 'Chef',
              department: 'Salmiya',
              docKey: 'healthCardExpiry' as const,
              docLabelAr: 'كرت الصحة',
              docLabelEn: 'Health Card',
              expiryDate: '2027-05-01',
              daysLeft: 160,
              band: 'valid' as const,
            },
          ],
          missing: [
            {
              employeeId: 'emp-1',
              code: '2090',
              name: 'Anand Rao',
              jobTitle: 'Chef',
              department: 'Salmiya',
              docKey: 'passportExpiry' as const,
              docLabelAr: 'جواز السفر',
              docLabelEn: 'Passport',
              expiryDate: null,
              daysLeft: null,
              band: 'missing' as const,
            },
          ],
        },
        renewalDispatch: {
          body: 'Urgent list',
          recipients: [
            {
              name: 'GRO Test Officer',
              mobile: '+965 90000001',
              email: 'gro@venturefoodskw.com',
              whatsapp: 'https://wa.me/96590000001',
              mailto: 'mailto:gro@venturefoodskw.com',
            },
          ],
        },
      }

      const arHtml = renderWithLocale('ar', el(ComplianceRadarClient, { initial: radarData, locale: 'ar' }))
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('Anand Rao')
      expect(arHtml).toContain('2026-10-01')
      expect(arHtml).toContain('GRO Test Officer — +965 90000001')
      expect(arHtml).toContain('title="غير متاح"')
      expect(arHtml).not.toContain('Jahra Excluded Employee')
      expect(arHtml).not.toContain('text-[11px]')

      const emptyEnHtml = renderWithLocale(
        'en',
        el(ComplianceRadarClient, {
          initial: {
            totals: { employees: 0, expired: 0, d30: 0, d60: 0, valid: 0, missing: 0 },
            groups: { expired: [], d30: [], d60: [], valid: [], missing: [] },
            renewalDispatch: { body: '', recipients: [] },
          },
          locale: 'en',
        }),
      )
      expect(emptyEnHtml).toContain('dir="ltr"')
      expect(emptyEnHtml).toContain('data-state-block="empty"')
    })
  })

  describe('3. /hr/smart-folder-upload — SmartFolderUploadClient', () => {
    it('renders accessible dropzone, empty StateBlock, and RTL/LTR parity', () => {
      const arHtml = renderWithLocale(
        'ar',
        el(SmartFolderUploadClient, {
          employees: [{ id: 'emp-1', name: 'Anand Rao', code: '2090', department: 'Salmiya' }],
          locale: 'ar',
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('data-state-block="empty"')
      expect(arHtml).toContain('aria-label="اختيار ملفات الموظفين للرفع"')

      const enHtml = renderWithLocale(
        'en',
        el(SmartFolderUploadClient, { employees: [], locale: 'en' }),
      )
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('Ready for HR folder or document upload')
    })
  })

  describe('4. /smart-ingest/[module] — SmartDepartmentFolderUpload', () => {
    it('renders all 6 modules bilingually without internal dev copy leaks', () => {
      for (const mod of SMART_INGEST_MODULES) {
        const arHtml = renderWithLocale('ar', el(SmartDepartmentFolderUpload, { module: mod, locale: 'ar' }))
        const enHtml = renderWithLocale('en', el(SmartDepartmentFolderUpload, { module: mod, locale: 'en' }))
        expect(arHtml).toContain('dir="rtl"')
        expect(enHtml).toContain('dir="ltr"')
        expect(arHtml).toContain('data-state-block="empty"')
        expect(enHtml).toContain('data-state-block="empty"')
        expect(arHtml).not.toContain('Dark Obsidian')
        expect(enHtml).not.toContain('safeStorageKey')
      }
    })
  })

  describe('5. /audit — AuditLogView', () => {
    it('renders Kuwait timestamps (UTC+3), text-start headers, explicit CSV label, empty/error states, and zero banned buzzwords', () => {
      const arHtml = renderWithLocale(
        'ar',
        el(AuditLogView, {
          locale: 'ar',
          q: '',
          moduleKey: '',
          page: 1,
          total: 1,
          rows: [
            {
              id: 'log-1',
              createdAt: '2026-11-15T22:15:00.000Z',
              module: 'hr',
              action: 'CREATE',
              details: 'إنشاء سجل موظف',
              user: { name: 'Sheyam Hekmat', email: 'sheyamh@venturefoodskw.com' },
            },
          ],
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      // 2026-11-15T22:15Z in Asia/Kuwait (UTC+3) is 2026-11-16 01:15
      expect(arHtml).toContain('2026-11-16 01:15')
      expect(arHtml).toContain('تصدير سجل العمليات (CSV)')
      expect(arHtml).not.toContain('جدول المخزون')
      expect(arHtml).not.toContain('text-right')
      expect(arHtml).not.toContain('سجل التدقيق')

      const emptyEnHtml = renderWithLocale(
        'en',
        el(AuditLogView, {
          locale: 'en',
          q: 'missing',
          moduleKey: '',
          page: 1,
          total: 0,
          rows: [],
        }),
      )
      expect(emptyEnHtml).toContain('dir="ltr"')
      expect(emptyEnHtml).toContain('data-state-block="empty"')
      expect(emptyEnHtml).toContain('Export Activity Log (CSV)')

      const errorHtml = renderWithLocale(
        'en',
        el(AuditLogView, {
          locale: 'en',
          q: '',
          moduleKey: '',
          page: 1,
          total: 0,
          rows: [],
          hasError: true,
        }),
      )
      expect(errorHtml).toContain('data-state-block="error"')
      expect(errorHtml).toContain('role="alert"')
    })
  })

  describe('6. /ess — EssPortalClient', () => {
    const profileFixture: EssProfile = {
      employee: {
        id: 'emp-1',
        code: '2090',
        name: 'Anand Rao',
        jobTitle: 'Chef de Partie',
        department: 'Salmiya Branch',
        civilId: '291010100123',
        civilIdExpiry: '2027-06-15',
        passportExpiry: null,
        healthCardExpiry: '2026-12-20',
        workPermitExpiry: null,
        drivingLicenseExpiry: null,
      },
      payrolls: [
        { id: 'p-1', month: 11, year: 2026, netSalary: 450.75, basicSalary: 390, status: 'PAID' },
      ],
      attendance: [
        {
          id: 'a-1',
          date: '2026-11-15',
          status: 'PRESENT',
          checkIn: '2026-11-15T05:30:00.000Z',
          checkOut: '2026-11-15T13:45:00.000Z',
          hoursWorked: 8.25,
        },
      ],
      documents: [],
    }

    it('renders loading skeleton on initial mount and full authenticated AR/EN profile with 3-decimal KWD & Kuwait times', () => {
      const loadingHtml = renderWithLocale('ar', el(EssPortalClient, {}))
      expect(loadingHtml).toContain('data-state-block="loading"')

      const arHtml = renderWithLocale('ar', el(EssPortalClient, { initialProfile: profileFixture }))
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('450.750 د.ك')
      // 05:30Z -> 08:30 Asia/Kuwait, 13:45Z -> 16:45 Asia/Kuwait
      expect(arHtml).toContain('08:30')
      expect(arHtml).toContain('16:45')
      expect(arHtml).toContain('title="غير متاح"')
      expect(arHtml).toContain('إجازة تعويضية')
      expect(arHtml).toContain('data-state-block="empty"')

      const enHtml = renderWithLocale(
        'en',
        el(EssPortalClient, {
          initialProfile: { ...profileFixture, payrolls: [], attendance: [] },
        }),
      )
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('title="Unavailable"')
      expect(enHtml).toContain('No payslips available')
      expect(enHtml).toContain('No attendance records yet')
    })
  })

  describe('7. Static & Hygiene Invariants across all Wave 3B HR/Ingest/Audit/ESS owned files', () => {
    it('passes zero sub-12px fonts, zero console.*, zero explicit any, zero @ts-ignore, zero banned buzzwords, and zero raw img tags', async () => {
      const ownedFiles = [
        'src/app/(panel)/hr/page.tsx',
        'src/app/(panel)/hr/hr-forms.tsx',
        'src/app/(panel)/hr/compliance-radar/page.tsx',
        'src/app/(panel)/hr/compliance-radar/radar-client.tsx',
        'src/app/(panel)/hr/smart-folder-upload/page.tsx',
        'src/app/(panel)/hr/smart-folder-upload/upload-client.tsx',
        'src/app/(panel)/smart-ingest/[module]/page.tsx',
        'src/app/(panel)/audit/page.tsx',
        'src/app/(panel)/audit/audit-view.tsx',
        'src/app/ess/page.tsx',
        'src/app/ess/ess-client.tsx',
        'src/components/hr/EnterpriseHrCommandHub.tsx',
        'src/components/hr/hr-employee-summary.ts',
        'src/components/hr/NewEmployeeWizardModal.tsx',
        'src/components/hr/hr-avatar-utils.ts',
        'src/components/hr/hr-enterprise-data.ts',
        'src/components/hr/venture-employees-directory.ts',
        'src/components/hr-digital-dossier.tsx',
        'src/components/hr-wps-toolbar.tsx',
        'src/components/SmartDepartmentFolderUpload.tsx',
      ]

      for (const rel of ownedFiles) {
        const content = await readFile(path.join(process.cwd(), rel), 'utf8')
        expect(content, `${rel} sub-12px`).not.toMatch(/text-\[(?:10|10\.5|11|11\.5)px\]/)
        expect(content, `${rel} console.*`).not.toMatch(/\bconsole\.(log|debug|info|warn|error)\b/)
        expect(content, `${rel} explicit any`).not.toMatch(/:\s*any\b|\bas any\b|<any>/)
        expect(content, `${rel} ts-ignore`).not.toMatch(/@ts-(ignore|nocheck)/)
        expect(content, `${rel} raw <img>`).not.toMatch(/<img\b/)
        expect(content, `${rel} banned buzzwords`).not.toMatch(
          /\bWatchdog\b|Verified Executive|Live Odoo|سجل التدقيق/i,
        )
        expect(content, `${rel} Hawally string`).not.toMatch(/\u062d\u0648\u0644\u064a|hawally|hawalli/i)
      }
    })
  })
})
