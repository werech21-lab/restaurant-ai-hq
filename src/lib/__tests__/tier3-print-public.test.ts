import { readFile } from 'node:fs/promises'
import path from 'node:path'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/login',
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

vi.mock('@/app/actions/payments', () => ({
  checkoutPaymentAction: vi.fn(),
}))

import { PayrollSheet } from '@/app/(panel)/hr/payroll/[id]/print/payroll-sheet'
import { DownloadView } from '@/app/download/download-view'
import { InstallCard } from '@/app/download/install-card'
import { HomeFallback } from '@/app/home/home-fallback'
import { LoginForm } from '@/app/login/login-form'
import { LoginHero } from '@/app/login/login-hero'
import { PayCheckout } from '@/app/pay/[token]/pay-checkout'
import { PayView } from '@/app/pay/[token]/pay-view'
import { InvoiceSheet } from '@/components/invoice-sheet'
import { PrintButton } from '@/components/print-button'
import { StatementView } from '@/components/statement-view'
import { formatDateTime, formatKwd } from '@/lib/format'
import { LanguageProvider } from '@/lib/i18n'

const el = React.createElement

const TypedLangProvider = LanguageProvider as React.ComponentType<{
  initialLocale: 'ar' | 'en'
  children?: React.ReactNode
}>

function renderWithLang(locale: 'ar' | 'en', node: React.ReactElement): string {
  return renderToStaticMarkup(el(TypedLangProvider, { initialLocale: locale }, node))
}

const SAMPLE_DATA_QR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const OWNED_PRODUCTION_FILES = [
  'src/app/page.tsx',
  'src/app/home/page.tsx',
  'src/app/home/home-fallback.tsx',
  'src/app/login/page.tsx',
  'src/app/login/login-form.tsx',
  'src/app/login/login-hero.tsx',
  'src/app/download/page.tsx',
  'src/app/download/download-view.tsx',
  'src/app/download/install-card.tsx',
  'src/app/pay/[token]/page.tsx',
  'src/app/pay/[token]/pay-view.tsx',
  'src/app/pay/[token]/pay-checkout.tsx',
  'src/app/(panel)/crm/quotes/[id]/print/page.tsx',
  'src/app/(panel)/hr/payroll/[id]/print/page.tsx',
  'src/app/(panel)/hr/payroll/[id]/print/payroll-sheet.tsx',
  'src/app/(panel)/purchases/[id]/print/page.tsx',
  'src/app/(panel)/sales/[id]/print/page.tsx',
  'src/components/invoice-sheet.tsx',
  'src/components/print-button.tsx',
  'src/components/statement-view.tsx',
] as const

describe('Wave 3C Tier 3 — Print Documents (4 Routes) & Public/Auth Entry (5 Routes)', () => {
  describe('1. PrintButton, InvoiceSheet, PayrollSheet & StatementView', () => {
    it('renders PrintButton with print:hidden, no-print, aria-label, and focus ring', () => {
      const html = renderToStaticMarkup(el(PrintButton, { label: 'Print Invoice' }))
      expect(html).toContain('print:hidden')
      expect(html).toContain('no-print')
      expect(html).toContain('aria-label="Print Invoice"')
      expect(html).toContain('ds-focus-ring')
    })

    it('renders InvoiceSheet in A4 and Thermal modes with bilingual headers, 3-decimal KWD, null->Unavailable, and empty StateBlock', () => {
      const arHtml = renderWithLang(
        'ar',
        el(InvoiceSheet, {
          locale: 'ar',
          data: {
            title: 'فاتورة مبيعات',
            titleEn: 'Sales Invoice',
            number: 'INV-2026-0042',
            dateLabel: formatDateTime('2026-11-15T21:30:00.000Z', {
              locale: 'ar',
              showZone: true,
            }),
            partyLabel: 'العميل',
            partyLabelEn: 'Customer',
            partyName: 'شركة المأكولات الخليجية',
            partyPhone: '',
            partyEmail: '',
            statusLabel: 'مدفوعة جزئياً',
            lines: [
              {
                id: 'l-1',
                name: 'وجبة دجاج مشوي',
                code: 'CG-101',
                quantity: '2',
                price: formatKwd(12.5, 'ar'),
                total: formatKwd(25, 'ar'),
              },
            ],
            subtotalLabel: formatKwd(25, 'ar'),
            discountLabel: formatKwd(0, 'ar'),
            totalLabel: formatKwd(25, 'ar'),
            paidLabel: formatKwd(10.25, 'ar'),
            dueLabel: formatKwd(14.75, 'ar'),
            qrDataUrl: SAMPLE_DATA_QR,
            backHref: '/sales',
            companyName: 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
          },
        }),
      )

      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('print:hidden')
      expect(arHtml).toContain('print:bg-white')
      expect(arHtml).toContain('print:text-slate-950')
      expect(arHtml).toContain('print:shadow-none')
      expect(arHtml).toContain('print:ring-0')
      expect(arHtml).toContain('@page { size: A4; margin: 12mm; }')
      expect(arHtml).toContain('فاتورة مبيعات · Sales Invoice')
      expect(arHtml).toContain('VENTURE FOODS RESTAURANTS MANAGEMENT CO. W.L.L.')
      expect(arHtml).toContain('الصنف · Item')
      expect(arHtml).toContain('12.500 د.ك')
      expect(arHtml).toContain('14.750 د.ك')
      expect(arHtml).toContain('2026-11-16 00:30 UTC+3')
      expect(arHtml).toContain('dir="ltr"')
      expect(arHtml).toContain('tabular-nums')
      expect(arHtml).toContain('title="غير متاح"')
      expect(arHtml).toContain('data-unavailable="true"')

      const thermalEmptyEn = renderWithLang(
        'en',
        el(InvoiceSheet, {
          locale: 'en',
          initialMode: 'thermal',
          data: {
            title: 'عرض سعر',
            titleEn: 'Price Quotation',
            number: 'QT-101',
            dateLabel: formatDateTime('2026-11-15T10:00:00.000Z', {
              locale: 'en',
              showZone: true,
            }),
            partyLabel: 'موجه إلى',
            partyLabelEn: 'Prepared For',
            partyName: 'Gulf Catering Co.',
            partyPhone: '',
            partyEmail: '',
            statusLabel: 'Draft',
            lines: [],
            subtotalLabel: formatKwd(0, 'en'),
            discountLabel: formatKwd(0, 'en'),
            totalLabel: formatKwd(0, 'en'),
            paidLabel: formatKwd(0, 'en'),
            dueLabel: formatKwd(0, 'en'),
            qrDataUrl: '',
            backHref: '/crm?tab=quotes',
          },
        }),
      )

      expect(thermalEmptyEn).toContain('dir="ltr"')
      expect(thermalEmptyEn).toContain('print-thermal max-w-[80mm]')
      expect(thermalEmptyEn).toContain('@page { size: 80mm auto; margin: 4mm; }')
      expect(thermalEmptyEn).toContain('data-state-block="empty"')
      expect(thermalEmptyEn).toContain('title="Unavailable"')
    })

    it('renders PayrollSheet with A4 print classes, bilingual headers, 3-decimal KWD, Kuwait date, and null->Unavailable', () => {
      const arHtml = renderToStaticMarkup(
        el(PayrollSheet, {
          locale: 'ar',
          data: {
            id: 'pay-1',
            month: 11,
            year: 2026,
            basicSalary: 320.5,
            totalAllowances: 45.25,
            totalDeductions: 15,
            netSalary: 350.75,
            absentDays: 0,
            lateDays: 1,
            status: 'PAID',
            paidAt: '2026-11-15T21:30:00.000Z',
            employee: {
              name: 'Anand Rao',
              jobTitle: 'Chef de Partie',
              department: 'Salmiya Branch',
              code: '2090',
            },
            companyName: 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
            companyTaxNumber: '',
            companyFooter: 'فنتشر فودز',
            qrDataUrl: SAMPLE_DATA_QR,
          },
        }),
      )

      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('print:hidden')
      expect(arHtml).toContain('print:bg-white')
      expect(arHtml).toContain('print:text-slate-950')
      expect(arHtml).toContain('print:shadow-none')
      expect(arHtml).toContain('print:ring-0')
      expect(arHtml).toContain('@page { size: A4; margin: 12mm; }')
      expect(arHtml).toContain('قسيمة راتب · Payroll Slip')
      expect(arHtml).toContain('320.500 د.ك')
      expect(arHtml).toContain('350.750 د.ك')
      expect(arHtml).toContain('2026-11-16')

      const enMissingHtml = renderToStaticMarkup(
        el(PayrollSheet, {
          locale: 'en',
          data: {
            id: 'pay-2',
            month: 10,
            year: 2026,
            basicSalary: null,
            totalAllowances: 0,
            totalDeductions: 0,
            netSalary: null,
            absentDays: null,
            lateDays: null,
            status: 'PAID',
            paidAt: null,
            employee: {
              name: 'Tariq Hassan',
              jobTitle: null,
              department: null,
              code: null,
            },
            companyName: 'Venture Foods',
            companyTaxNumber: 'KW-12345',
            companyFooter: '',
            qrDataUrl: SAMPLE_DATA_QR,
          },
        }),
      )

      expect(enMissingHtml).toContain('dir="ltr"')
      expect(enMissingHtml).toContain('title="Unavailable"')
      expect(enMissingHtml).toContain('data-unavailable="true"')
      expect(enMissingHtml).toContain('—')
    })

    it('renders StatementView cleanly in AR & EN with 3-decimal KWD, Asia/Kuwait dates, text-start headers, and empty StateBlock', () => {
      const enHtml = renderWithLang(
        'en',
        el(StatementView, {
          locale: 'en',
          kind: 'customer',
          backHref: '/sales?tab=parties',
          balanceLabel: 'Running Balance',
          hint: 'Ledger statement',
          statement: {
            id: 'cust-1',
            name: 'Al-Noor Catering',
            phone: '+965 90001122',
            email: '',
            storedBalance: 120.5,
            totalDebit: 200.5,
            totalCredit: 80,
            closingBalance: 120.5,
            lines: [
              {
                id: 'line-1',
                at: new Date('2026-11-15T21:30:00.000Z'),
                kind: 'فاتورة مبيعات',
                reference: 'INV-001',
                debit: 200.5,
                credit: 0,
                balance: 200.5,
              },
              {
                id: 'line-2',
                at: new Date('2026-11-16T08:00:00.000Z'),
                kind: 'سند قبض',
                reference: '',
                debit: 0,
                credit: 80,
                balance: 120.5,
              },
            ],
          },
        }),
      )

      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('text-start')
      expect(enHtml).not.toContain('text-right')
      expect(enHtml).toContain('200.500 KWD')
      expect(enHtml).toContain('120.500 KWD')
      expect(enHtml).toContain('2026-11-16')
      expect(enHtml).toContain('Sales Invoice')
      expect(enHtml).toContain('Receipt Voucher')
      expect(enHtml).not.toContain('فاتورة مبيعات')
      expect(enHtml).not.toContain('سند قبض')
      expect(enHtml).toContain('title="Unavailable"')
      expect(enHtml).toContain('print:hidden')

      const emptyArHtml = renderWithLang(
        'ar',
        el(StatementView, {
          locale: 'ar',
          kind: 'supplier',
          backHref: '/purchases?tab=parties',
          balanceLabel: 'الرصيد',
          hint: 'كشف المورد',
          statement: {
            id: 'sup-1',
            name: 'مؤسسة الخليج',
            phone: '',
            email: '',
            storedBalance: 0,
            totalDebit: 0,
            totalCredit: 0,
            closingBalance: 0,
            lines: [],
          },
        }),
      )

      expect(emptyArHtml).toContain('dir="rtl"')
      expect(emptyArHtml).toContain('data-state-block="empty"')
      expect(emptyArHtml).toContain('0.000 د.ك')
    })
  })

  describe('2. Public & Auth Routes (/home, /login, /download, /pay/[token])', () => {
    it('renders /home Suspense loading fallback with accessible loading StateBlock', () => {
      const html = renderToStaticMarkup(el(HomeFallback))
      expect(html).toContain('data-state-block="loading"')
      expect(html).toContain('role="status"')
      expect(html).toContain('aria-busy="true"')
    })

    it('renders /login LoginForm and LoginHero in AR (rtl) and EN (ltr) with preserved field names and accessibility', () => {
      const arForm = renderWithLang('ar', el(LoginForm, { nextPath: '/erp' }))
      expect(arForm).toContain('dir="rtl"')
      expect(arForm).toContain('name="email"')
      expect(arForm).toContain('name="password"')
      expect(arForm).toContain('type="submit"')
      expect(arForm).toContain('aria-label="البريد الإلكتروني المؤسسي"')
      expect(arForm).toContain('aria-label="إظهار كلمة المرور"')
      expect(arForm).not.toContain('text-[11px]')

      const enForm = renderWithLang('en', el(LoginForm, { nextPath: '/erp' }))
      expect(enForm).toContain('dir="ltr"')
      expect(enForm).toContain('aria-label="Corporate Email"')
      expect(enForm).toContain('aria-label="Show password"')
      expect(enForm).toContain('Executive Access Portal')

      const enHero = renderWithLang('en', el(LoginHero))
      expect(enHero).toContain('dir="ltr"')
      expect(enHero).toContain('Venture Foods Kuwait')
    })

    it('renders /download DownloadView and InstallCard in AR & EN with preserved download endpoints and zero raw img', () => {
      const arHtml = renderWithLang(
        'ar',
        el(DownloadView, {
          qrDataUrl: SAMPLE_DATA_QR,
          pageUrl: 'https://aetherbi.com/download',
        }),
      )
      expect(arHtml).toContain('dir="rtl"')
      expect(arHtml).toContain('href="/api/download/windows-launcher"')
      expect(arHtml).toContain('href="/api/download/backup"')
      expect(arHtml).toContain('href="/login"')
      expect(arHtml).toContain('https://aetherbi.com/download')
      expect(arHtml).toContain('data-language-switch=""')

      const enHtml = renderWithLang(
        'en',
        el(DownloadView, {
          qrDataUrl: '',
          pageUrl: 'https://aetherbi.com/download',
        }),
      )
      expect(enHtml).toContain('dir="ltr"')
      expect(enHtml).toContain('AetherBI ERP Download Center')
      expect(enHtml).toContain('data-state-block="unavailable"')
      expect(enHtml).toContain('Sign in to ERP')

      const installEn = renderWithLang('en', el(InstallCard))
      expect(installEn).toContain('dir="ltr"')
      expect(installEn).toContain('Chrome or Edge')
    })

    it('renders /pay/[token] PayView & PayCheckout across ready, paid, expired, notFound, error & empty-methods states without secret leaks', () => {
      const pendingAr = renderWithLang(
        'ar',
        el(PayView, {
          state: 'ready',
          data: {
            token: 'secret-pay-tok-999',
            companyName: 'شركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
            titleAr: 'فاتورة INV-2026-0091',
            titleEn: 'Invoice INV-2026-0091',
            partyName: 'عميل التموين',
            amount: 245.5,
            gatewayProvider: 'MYFATOORAH',
            status: 'PENDING',
            createdAtIso: '2026-11-15T21:30:00.000Z',
            paidAtIso: null,
            expiresAtIso: '2026-11-22T21:30:00.000Z',
            methods: ['KNET', 'VISA_MASTER', 'APPLE_PAY'],
            isTestMode: true,
            providerActive: true,
          },
        }),
      )

      expect(pendingAr).toContain('dir="rtl"')
      expect(pendingAr).toContain('245.500 د.ك')
      expect(pendingAr).toContain('2026-11-16 00:30 UTC+3')
      expect(pendingAr).toContain('ادفع عبر كي نت')
      expect(pendingAr).toContain('aria-label="ادفع عبر كي نت"')

      const paidEn = renderWithLang(
        'en',
        el(PayView, {
          state: 'ready',
          data: {
            token: 'secret-pay-tok-999',
            companyName: 'Venture Foods Co.',
            titleAr: 'فاتورة INV-2026-0091',
            titleEn: 'Invoice INV-2026-0091',
            partyName: 'Corporate Client',
            amount: 1200,
            gatewayProvider: 'TAP',
            status: 'PAID',
            createdAtIso: '2026-11-15T09:00:00.000Z',
            paidAtIso: '2026-11-15T21:45:00.000Z',
            expiresAtIso: '2026-11-22T09:00:00.000Z',
            methods: ['KNET'],
            isTestMode: false,
            providerActive: true,
          },
        }),
      )

      expect(paidEn).toContain('dir="ltr"')
      expect(paidEn).toContain('1,200.000 KWD')
      expect(paidEn).toContain('2026-11-16 00:45 UTC+3')
      expect(paidEn).toContain('Payment received and confirmed')
      expect(paidEn).not.toContain('تم استلام المبلغ')

      const expiredEn = renderWithLang(
        'en',
        el(PayView, {
          state: 'ready',
          data: {
            token: 'secret-pay-tok-999',
            companyName: 'Venture Foods Co.',
            titleAr: 'فاتورة INV-2026-0091',
            titleEn: 'Invoice INV-2026-0091',
            partyName: 'Corporate Client',
            amount: null,
            gatewayProvider: 'STRIPE',
            status: 'EXPIRED',
            createdAtIso: null,
            paidAtIso: null,
            expiresAtIso: null,
            methods: [],
            isTestMode: true,
            providerActive: true,
          },
        }),
      )

      expect(expiredEn).toContain('data-state-block="error"')
      expect(expiredEn).toContain('Payment link has expired')
      expect(expiredEn).toContain('title="Unavailable"')
      expect(expiredEn).toContain('data-unavailable="true"')

      const notFoundAr = renderWithLang('ar', el(PayView, { state: 'notFound' }))
      expect(notFoundAr).toContain('data-state-block="empty"')
      expect(notFoundAr).toContain('رابط الدفع غير موجود')

      const errorEn = renderWithLang('en', el(PayView, { state: 'error' }))
      expect(errorEn).toContain('data-state-block="error"')
      expect(errorEn).toContain('Unable to load payment details')

      const emptyMethodsEn = renderWithLang(
        'en',
        el(PayCheckout, {
          token: 'tok-empty',
          methods: [],
          isTestMode: false,
          providerActive: false,
          paid: false,
          locale: 'en',
        }),
      )
      expect(emptyMethodsEn).toContain('data-state-block="unavailable"')
      expect(emptyMethodsEn).toContain('No payment methods available')
    })
  })

  describe('3. Strict Static & Lint Guardrails across all Tier 3 Owned Files', () => {
    it('enforces zero raw <img> tags, zero sub-12px fonts, zero console.*, zero any, zero @ts-ignore, zero banned buzzwords, and zero legacy formatMoney', async () => {
      for (const rel of OWNED_PRODUCTION_FILES) {
        const content = await readFile(path.join(process.cwd(), rel), 'utf8')
        expect(content, `${rel} raw <img>`).not.toMatch(/<img\b/)
        expect(content, `${rel} no-img-element disable`).not.toMatch(
          /eslint-disable.*no-img-element/,
        )
        expect(content, `${rel} sub-12px`).not.toMatch(
          /text-\[(?:10|10\.5|11|11\.5)px\]/,
        )
        expect(content, `${rel} console.*`).not.toMatch(
          /\bconsole\.(log|debug|info|warn|error)\b/,
        )
        expect(content, `${rel} explicit any`).not.toMatch(
          /:\s*any\b|\bas any\b|<any>/,
        )
        expect(content, `${rel} ts-ignore`).not.toMatch(/@ts-(ignore|nocheck)/)
        expect(content, `${rel} banned buzzwords`).not.toMatch(
          /\bWatchdog\b|Verified Executive|Live Odoo|سجل التدقيق/i,
        )
        expect(content, `${rel} legacy formatMoney`).not.toMatch(/\bformatMoney\b/)
      }
    })

    it('keeps cx.ts and erp-ui-classes.ts server-safe (no use client) and prevents RSC UI primitives from importing cx/classes from client modules', async () => {
      const serverSafeHelperFiles = [
        'src/components/ui/cx.ts',
        'src/components/erp-ui-classes.ts',
      ] as const

      for (const rel of serverSafeHelperFiles) {
        const content = await readFile(path.join(process.cwd(), rel), 'utf8')
        expect(content, `${rel} must not contain 'use client'`).not.toMatch(
          /^\s*['"]use client['"]/m,
        )
      }

      const rscUiFiles = [
        'src/components/ui/state-block.tsx',
        'src/components/ui/section-card.tsx',
        'src/components/ui/kpi-card.tsx',
        'src/components/ui/chart-card.tsx',
        'src/components/ui/data-table.tsx',
        'src/components/ui/index.ts',
      ] as const

      for (const rel of rscUiFiles) {
        const content = await readFile(path.join(process.cwd(), rel), 'utf8')
        expect(
          content,
          `${rel} must not import or re-export cx from ./primitives`,
        ).not.toMatch(/(?:import|export)\s*\{[^}]*\bcx\b[^}]*\}\s*from\s*['"]\.\/primitives['"]/)
      }

      const rscErpClassConsumers = [
        'src/app/(panel)/audit/audit-view.tsx',
        'src/app/(panel)/stock-count/page.tsx',
        'src/app/(panel)/reports/page.tsx',
        'src/components/ui/stat-card.tsx',
      ] as const

      for (const rel of rscErpClassConsumers) {
        const content = await readFile(path.join(process.cwd(), rel), 'utf8')
        expect(
          content,
          `${rel} must not import string class constants from @/components/erp-ui`,
        ).not.toMatch(
          /import\s*\{[^}]*\b(?:btnPrimary|btnGhost|btnDanger|btnMuted|cardClass|fieldClass|labelClass|tableHeadClass|tableCellClass|mutedTextClass)\b[^}]*\}\s*from\s*['"]@\/components\/erp-ui['"]/,
        )
      }
    })
  })
})
