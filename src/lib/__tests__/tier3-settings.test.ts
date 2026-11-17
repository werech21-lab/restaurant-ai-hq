import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/settings',
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

import { AppBuilderPanel } from '@/app/(panel)/app-builder/app-builder-panel'
import { AutomationsPanel } from '@/app/(panel)/automations/automations-panel'
import { DeployView } from '@/app/(panel)/deploy/deploy-view'
import { DirectoryView } from '@/app/(panel)/directory/directory-view'
import { ProfileForm } from '@/app/(panel)/profile/profile-form'
import { ProfileView } from '@/app/(panel)/profile/profile-view'
import { SaasPanel } from '@/app/(panel)/saas/saas-panel'
import { SaasView } from '@/app/(panel)/saas/saas-view'
import { AppsView } from '@/app/(panel)/settings/apps/apps-view'
import { NotificationWizard } from '@/app/(panel)/settings/notifications/notification-wizard'
import { GatewayForm } from '@/app/(panel)/settings/payments/gateway-form'
import Settings from '@/components/Settings'
import { VentureAutomationHub } from '@/components/automation/VentureAutomationHub'
import { formatDate, formatDateTime, formatInt, formatKwd, formatPct } from '@/lib/format'
import { LanguageProvider } from '@/lib/i18n'
import { MODULES } from '@/lib/modules'
import { ThemeProvider, type Theme } from '@/lib/theme'

const el = React.createElement

const TypedLangProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

const TypedThemeProvider = ThemeProvider as React.ComponentType<{
  initialTheme?: Theme
  children?: React.ReactNode
}>

function renderWithProviders(
  locale: 'ar' | 'en',
  node: React.ReactElement,
  theme: Theme = 'dark',
): string {
  return renderToStaticMarkup(
    el(
      TypedLangProvider,
      { initialLocale: locale },
      el(TypedThemeProvider, { initialTheme: theme }, node),
    ),
  )
}

describe('Wave 3C Tier 3 — 11 Panel Settings, App Builder, Automation, Deploy, Directory, Profile & SaaS Routes', () => {
  describe('0. Canonical KWD 3-decimal & Asia/Kuwait formatting invariants', () => {
    it('formats KWD strictly to 3 decimals, counts with commas, and UTC timestamps to Asia/Kuwait (UTC+3)', () => {
      expect(formatKwd(1250.5, 'en')).toBe('1,250.500 KWD')
      expect(formatKwd(1250.5, 'ar')).toBe('1,250.500 د.ك')
      expect(formatKwd(null, 'ar')).toBe('—')
      expect(formatInt(166, 'en')).toBe('166')
      expect(formatPct(0, 'en')).toBe('0.0%')
      expect(formatDate('2026-11-15T22:30:00.000Z', 'en')).toBe('2026-11-16')
      expect(formatDateTime('2026-11-15T22:30:00.000Z', 'en')).toBe('2026-11-16 01:30')
    })
  })

  describe('1. /app-builder — AppBuilderPanel', () => {
    it('renders AR/EN parity, locked module guard, empty custom fields StateBlock, and loading/error states', () => {
      const modules = [
        {
          key: 'dashboard',
          name: 'لوحة التحكم',
          description: 'نظرة تنفيذية عامة',
          isEnabled: true,
          locked: true,
        },
        {
          key: 'crm',
          name: 'علاقات العملاء',
          description: 'العملاء وعروض الأسعار',
          isEnabled: false,
          locked: false,
        },
      ]
      const fields = [
        {
          id: 'fld-1',
          entityType: 'PRODUCT',
          fieldName: 'Customs Code',
          fieldType: 'TEXT',
          options: '',
        },
      ]

      const arHtml = renderWithProviders(
        'ar',
        el(AppBuilderPanel, { locale: 'ar', modules, fields, canEdit: true }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('وحدة أساسية معتمدة')
      expect(arHtml).toContain('Customs Code')
      expect(arHtml).toContain('title="غير متاح"')

      const enHtml = renderWithProviders(
        'en',
        el(AppBuilderPanel, { locale: 'en', modules, fields: [], canEdit: true }),
      )
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('Core Locked Module')
      expect(enHtml).toContain('CRM')
      expect(enHtml).toContain('data-state-block="empty"')
      expect(enHtml).not.toContain('المنتجات والأصناف')

      const loadingHtml = renderWithProviders(
        'en',
        el(AppBuilderPanel, { locale: 'en', modules: [], fields: [], canEdit: false, loading: true }),
      )
      expect(loadingHtml).toContain('data-state-block="loading"')

      const errorHtml = renderWithProviders(
        'ar',
        el(AppBuilderPanel, { locale: 'ar', modules: [], fields: [], canEdit: false, hasError: true }),
      )
      expect(errorHtml).toContain('data-state-block="error"')
      expect(errorHtml).toContain('role="alert"')
    })
  })

  describe('2 & 3. /automation & /automations — VentureAutomationHub & AutomationsPanel', () => {
    it('renders VentureAutomationHub cleanly in AR/EN without leaked Arabic titleEn and keeps /automation re-export intact', async () => {
      const arHtml = renderWithProviders('ar', el(VentureAutomationHub, { locale: 'ar' }))
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('data-unlinked-source="true"')
      expect(arHtml).toContain('/erp/governance')

      const enHtml = renderWithProviders('en', el(VentureAutomationHub, { locale: 'en' }))
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('Unlinked from Source — Legacy Automation Rules')
      expect(enHtml).not.toContain('غير مربوط بمصدر')

      const automationPageSrc = await readFile(
        path.join(process.cwd(), 'src/app/(panel)/automation/page.tsx'),
        'utf8',
      )
      expect(automationPageSrc).toContain('from "../automations/page"')
    })

    it('renders AutomationsPanel bilingually across ready, empty, loading, and error states', () => {
      const arHtml = renderWithProviders(
        'ar',
        el(AutomationsPanel, {
          locale: 'ar',
          canCreate: true,
          suppliers: [{ id: 'sup-1', name: 'Al-Kout Trading' }],
          rules: [
            {
              id: 'r-1',
              name: 'تنبيه مخزون الدجاج',
              trigger: 'STOCK_BELOW_REORDER',
              action: 'DRAFT_PURCHASE',
              supplierName: '',
              isActive: true,
            },
          ],
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('تنبيه مخزون الدجاج')
      expect(arHtml).toContain('title="غير متاح"')

      const enEmpty = renderWithProviders(
        'en',
        el(AutomationsPanel, {
          locale: 'en',
          canCreate: false,
          suppliers: [],
          rules: [],
        }),
      )
      expect(enEmpty).toContain('dir="ltr"')
      expect(enEmpty).toContain('data-state-block="empty"')

      const errHtml = renderWithProviders(
        'en',
        el(AutomationsPanel, {
          locale: 'en',
          canCreate: false,
          suppliers: [],
          rules: [],
          hasError: true,
        }),
      )
      expect(errHtml).toContain('data-state-block="error"')
    })
  })

  describe('4. /deploy — DeployView & InstallButton', () => {
    it('renders AR/EN deployment runbook, install guidance, and loading/error states without secret or demo leaks', () => {
      const arHtml = renderWithProviders('ar', el(DeployView, { locale: 'ar' }))
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('حزمة النشر السحابي')
      expect(arHtml).toContain('/api/health')
      expect(arHtml).not.toContain('AUTH_SECRET')
      expect(arHtml).not.toContain('DATABASE_URL')

      const enHtml = renderWithProviders('en', el(DeployView, { locale: 'en' }))
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('Cloud Deployment Package')
      expect(enHtml).toContain('Install Application')
      expect(enHtml).toContain('docker compose up --build')

      const loadingHtml = renderWithProviders('en', el(DeployView, { locale: 'en', loading: true }))
      expect(loadingHtml).toContain('data-state-block="loading"')

      const errHtml = renderWithProviders('ar', el(DeployView, { locale: 'ar', hasError: true }))
      expect(errHtml).toContain('data-state-block="error"')
    })
  })

  describe('5. /directory — DirectoryView', () => {
    it('excludes Heisenberg, Qurain, Hawally & Jahra, marks missing contacts as unavailable, and enforces ltr numeric islands', () => {
      const people = [
        {
          person: {
            name: 'Abdullah Abdulghafar',
            title: 'Executive Secretary',
            ext: '102',
            direct: '22469500',
            mobile: '97386418',
            email: 'Sec@venturefoodskw.com',
            group: 'executive' as const,
          },
          employee: { id: 'e-1', code: '1002', phone: '+965 97386418', department: 'HQ' },
        },
        {
          person: {
            name: 'Samy Sabry',
            title: 'Accountant 1',
            ext: '111',
            group: 'finance' as const,
          },
          employee: null,
        },
        {
          person: {
            name: 'Heisenberg Legacy Manager',
            title: 'Closed Brand',
            ext: '999',
            group: 'ops' as const,
          },
          employee: null,
        },
      ]

      const hotlines = [
        { brand: 'China Garden', phones: ['1805080'], email: 'chinagarden@venturefoodskw.com' },
        { brand: 'Heisenberg Burger', phones: ['1111111'] },
      ]

      const branches = [
        {
          branch: {
            code: 'SAL',
            nameAr: 'فرع السالمية',
            nameEn: 'Salmiya Branch',
            ext: '401',
            direct: '25713993',
            email: 'salmiyacg@venturefoodskw.com',
            warehouseMatch: ['Salmiya'],
          },
          warehouse: { id: 'wh-1', name: 'Salmiya Store', location: 'Salmiya', managerName: 'Ops' },
        },
        {
          branch: {
            code: 'QRN',
            nameAr: 'فرع القرين',
            nameEn: 'Al-Qurain Branch',
            ext: '499',
            direct: '22222222',
            warehouseMatch: ['Qurain'],
          },
          warehouse: null,
        },
        {
          branch: {
            code: 'JHR',
            nameAr: 'فرع الجهراء',
            nameEn: 'Jahra Branch',
            ext: '498',
            direct: '22222223',
            warehouseMatch: ['Jahra'],
          },
          warehouse: null,
        },
        {
          branch: {
            code: 'HWL',
            nameAr: 'فرع حولي',
            nameEn: 'Hawally Branch',
            ext: '497',
            direct: '22222224',
            warehouseMatch: ['Hawally'],
          },
          warehouse: null,
        },
      ]

      const arHtml = renderWithProviders(
        'ar',
        el(DirectoryView, { locale: 'ar', people, hotlines, branches }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('Abdullah Abdulghafar')
      expect(arHtml).toContain('+965 97386418')
      expect(arHtml).toContain('title="غير متاح"')
      expect(arHtml).toContain('tabular-nums')
      expect(arHtml).toContain('overflow-x-auto')
      expect(arHtml).not.toContain('Heisenberg')
      expect(arHtml).not.toContain('Qurain')
      expect(arHtml).not.toContain('Jahra')
      expect(arHtml).not.toContain('Hawally')

      const enEmpty = renderWithProviders(
        'en',
        el(DirectoryView, { locale: 'en', people: [], hotlines: [], branches: [] }),
      )
      expect(enEmpty).toContain('dir="ltr"')
      expect(enEmpty).toContain('data-state-block="empty"')

      const errHtml = renderWithProviders(
        'en',
        el(DirectoryView, { locale: 'en', people: [], hotlines: [], branches: [], hasError: true }),
      )
      expect(errHtml).toContain('data-state-block="error"')
    })
  })

  describe('6. /profile — ProfileView & ProfileForm', () => {
    it('renders AR/EN account permissions cleanly and never includes password/PIN/role mutation inputs', () => {
      const permissionsMatrix = MODULES.slice(0, 3).map((m) => ({
        key: m.key,
        labelAr: m.label,
        labelKey: m.labelKey,
        view: true,
        create: false,
        edit: false,
        delete: false,
      }))

      const arHtml = renderWithProviders(
        'ar',
        el(ProfileView, {
          locale: 'ar',
          userName: 'Ahmad Al-Ebrahim',
          userEmail: 'ahmed@venturefoodskw.com',
          roleName: 'CEO',
          permissionsMatrix,
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('Ahmad Al-Ebrahim')
      expect(arHtml).toContain('نعم')
      expect(arHtml).not.toContain('type="password"')
      expect(arHtml).not.toContain('newPassword')

      const enHtml = renderWithProviders(
        'en',
        el(ProfileView, {
          locale: 'en',
          userName: 'Ahmad Al-Ebrahim',
          userEmail: 'ahmed@venturefoodskw.com',
          roleName: 'CEO',
          permissionsMatrix,
        }),
      )
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('My Profile')
      expect(enHtml).toContain('Yes')
      expect(enHtml).toContain('Save Profile')

      const formHtml = renderWithProviders(
        'en',
        el(ProfileForm, { name: 'Executive', locale: 'en' }),
      )
      expect(formHtml).toContain('name="name"')
      expect(formHtml).not.toContain('name="password"')
    })
  })

  describe('7. /saas — SaasView & SaasPanel', () => {
    it('renders real branch/brand/workforce counts without static invented numbers and formats null KPI + Kuwait dates', () => {
      const arHtml = renderWithProviders(
        'ar',
        el(SaasView, {
          locale: 'ar',
          companyName: 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
          companyCurrency: 'KWD',
          companyTaxRate: 0,
          activeEmployeesCount: null,
          enabledModulesCount: 19,
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('0.0%')
      expect(arHtml).toContain('title="غير متاح"')
      expect(arHtml).not.toContain('500,000')
      expect(arHtml).not.toContain('9,662')
      expect(arHtml).not.toContain('166 موظف')
      expect(arHtml).not.toContain('10 فروع')

      const panelEn = renderWithProviders(
        'en',
        el(SaasPanel, {
          locale: 'en',
          canEdit: true,
          moduleOptions: [{ key: 'dashboard', label: 'لوحة التحكم' }],
          organizations: [
            {
              id: 'org-1',
              name: 'Venture Foods W.L.L.',
              slug: 'venture-foods',
              plan: 'ENTERPRISE',
              currency: 'KWD',
              taxRate: 5,
              taxNumber: '',
              isDefault: true,
              isActive: true,
              ends: '2026-11-15T22:30:00.000Z',
              modules: ['dashboard'],
            },
          ],
        }),
      )
      expect(panelEn).toContain('dir="ltr"')
      expect(panelEn).toContain('5.0%')
      expect(panelEn).toContain('2026-11-16')
    })
  })

  describe('8. /settings — Settings component & /settings/page.tsx', () => {
    it('renders Settings in AR/EN with RTL/LTR parity, accessible toggle buttons, and light/dark tokens', () => {
      const arHtml = renderWithProviders('ar', el(Settings), 'light')
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('07:30')
      expect(arHtml).toContain('aria-pressed=')

      const enHtml = renderWithProviders('en', el(Settings), 'dark')
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('Language and appearance')
      expect(enHtml).toContain('Margin and finance alerts')
    })
  })

  describe('9. /settings/apps — AppsView', () => {
    it('renders QR image cleanly via next/image, supports AR/EN, and falls back to unavailable StateBlock when QR is null', () => {
      const arHtml = renderWithProviders(
        'ar',
        el(AppsView, {
          locale: 'ar',
          qrDataUrlValue: 'data:image/png;base64,iVBORw0KGgo=',
          installUrl: 'https://erp.aetherbi.com/dashboard',
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('width="176"')
      expect(arHtml).toContain('height="176"')
      expect(arHtml).toContain('https://erp.aetherbi.com/dashboard')

      const unavailEn = renderWithProviders(
        'en',
        el(AppsView, {
          locale: 'en',
          qrDataUrlValue: null,
          installUrl: 'https://erp.aetherbi.com/dashboard',
        }),
      )
      expect(unavailEn).toContain('dir="ltr"')
      expect(unavailEn).toContain('data-state-block="unavailable"')
      expect(unavailEn).toContain('Install QR code unavailable')
    })
  })

  describe('10. /settings/notifications — NotificationWizard', () => {
    it('masks secrets with type="password", renders AR/EN parity, and never leaks raw tokens', () => {
      const arHtml = renderWithProviders(
        'ar',
        el(NotificationWizard, {
          locale: 'ar',
          canEdit: true,
          chatId: '998877',
          chatName: 'VF Alerts',
          maskedToken: '••••4321',
          whatsappMode: 'CLICK',
          bridgeUrl: 'https://bridge.internal/send',
          bridgeSecretSet: true,
          metaPhoneNumberId: '100200300',
          metaTokenSet: true,
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('••••4321')
      expect(arHtml).toContain('•••• محفوظ')
      expect((arHtml.match(/type="password"/g) ?? []).length).toBe(3)

      const enHtml = renderWithProviders(
        'en',
        el(NotificationWizard, {
          locale: 'en',
          canEdit: true,
          chatId: '',
          chatName: '',
          maskedToken: '',
          whatsappMode: 'META',
          bridgeUrl: '',
          bridgeSecretSet: false,
          metaPhoneNumberId: '',
          metaTokenSet: false,
        }),
      )
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('One-Click Telegram Bot Integration')
      expect(enHtml).toContain('title="Unavailable"')
      expect((enHtml.match(/type="password"/g) ?? []).length).toBe(3)
    })
  })

  describe('11. /settings/payments — GatewayForm', () => {
    it('enforces type="password" on apiKey and webhookSecret, shows masked placeholders, and renders bilingual providers', () => {
      const arHtml = renderWithProviders(
        'ar',
        el(GatewayForm, {
          locale: 'ar',
          provider: 'MYFATOORAH',
          maskedKey: '••••9876',
          maskedSecret: '••••6543',
          isTestMode: true,
          isActive: true,
          methods: ['KNET', 'APPLE_PAY'],
          canEdit: true,
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('ماي فاتورة')
      expect(arHtml).toContain('••••9876')
      expect(arHtml).toContain('••••6543')
      expect((arHtml.match(/type="password"/g) ?? []).length).toBe(2)

      const enHtml = renderWithProviders(
        'en',
        el(GatewayForm, {
          locale: 'en',
          provider: 'TAP',
          maskedKey: '',
          maskedSecret: '',
          isTestMode: true,
          isActive: false,
          methods: ['KNET', 'VISA_MASTER'],
          canEdit: false,
        }),
      )
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('Tap Payments')
      expect(enHtml).toContain('title="Unavailable"')
      expect((enHtml.match(/type="password"/g) ?? []).length).toBe(2)
    })
  })

  describe('12. Static & Hygiene Guardrails across all Wave 3C Settings/Panel owned files', () => {
    it('passes zero sub-12px fonts, zero console.*, zero explicit any, zero @ts-ignore, zero raw <img>, zero banned buzzwords', async () => {
      const ownedFiles = [
        'src/app/(panel)/app-builder/page.tsx',
        'src/app/(panel)/app-builder/app-builder-panel.tsx',
        'src/app/(panel)/automation/page.tsx',
        'src/components/automation/VentureAutomationHub.tsx',
        'src/app/(panel)/automations/page.tsx',
        'src/app/(panel)/automations/automations-panel.tsx',
        'src/app/(panel)/deploy/page.tsx',
        'src/app/(panel)/deploy/deploy-view.tsx',
        'src/app/(panel)/deploy/install-button.tsx',
        'src/app/(panel)/directory/page.tsx',
        'src/app/(panel)/directory/directory-view.tsx',
        'src/app/(panel)/profile/page.tsx',
        'src/app/(panel)/profile/profile-view.tsx',
        'src/app/(panel)/profile/profile-form.tsx',
        'src/app/(panel)/saas/page.tsx',
        'src/app/(panel)/saas/saas-view.tsx',
        'src/app/(panel)/saas/saas-panel.tsx',
        'src/app/(panel)/settings/page.tsx',
        'src/components/Settings.tsx',
        'src/app/(panel)/settings/apps/page.tsx',
        'src/app/(panel)/settings/apps/apps-view.tsx',
        'src/app/(panel)/settings/notifications/page.tsx',
        'src/app/(panel)/settings/notifications/notification-wizard.tsx',
        'src/app/(panel)/settings/payments/page.tsx',
        'src/app/(panel)/settings/payments/gateway-form.tsx',
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
        expect(content, `${rel} nested <main>`).not.toMatch(/<main\b/)
      }
    })
  })
})
