import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_AUDITOR_EMAIL,
  EXEC_SESSION_COOKIE,
  createExecSessionToken,
} from '@/lib/auth/exec-session'
import { isErpRouteAllowedForRole } from '@/lib/auth/role-access-policy'
import {
  mapAuditorCustodianDisplay,
  redactAuditorPersonalNames,
} from '@/lib/accounting/auditor-redaction'
import { VentureAccountingHub } from '@/components/accounting/VentureAccountingHub'
import { middleware } from '@/middleware'

function buildAuthedRequest(
  pathname: string,
  token: string,
  method = 'GET',
  accept = 'text/html',
): NextRequest {
  return new NextRequest(`https://aetherbi.com${pathname}`, {
    method,
    headers: {
      cookie: `${EXEC_SESSION_COOKIE}=${token}`,
      accept,
      host: 'aetherbi.com',
    },
  })
}

describe('Auditor Server-Enforced RBAC Lockdown (Item 10)', () => {
  it('blocks /users and all IAM, HR, Directory, Admin, and Search paths on the server with HTTP 403', async () => {
    const auditorToken = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor')
    const adminToken = await createExecSessionToken(DEFAULT_ADMIN_EMAIL, 'admin')

    const blockedAuditorPaths = [
      '/users',
      '/directory',
      '/roles',
      '/hr',
      '/erp/hr',
      '/erp/iam',
      '/erp/org',
      '/erp/admin',
      '/admin',
      '/settings',
      '/pos',
      '/api/v1/iam/members',
      '/api/v1/iam/roles',
      '/api/v1/admin/accounts',
      '/api/v1/hr/employees',
      '/api/panel/search?q=gm',
      '/api/v1/search?q=gm',
    ]

    for (const p of blockedAuditorPaths) {
      const res = await middleware(buildAuthedRequest(p, auditorToken, 'GET'))
      expect(res.status, `Expected HTTP 403 for auditor GET ${p}`).toBe(403)
      const body = await res.text()
      expect(body).not.toContain('@venturefoodskw.com')
    }

    const adminUsersRes = await middleware(buildAuthedRequest('/users', adminToken, 'GET'))
    expect(adminUsersRes.status).toBe(200)
  })

  it('returns HTTP 403 for ANY POST, PUT, PATCH, or DELETE request made by auditor', async () => {
    const auditorToken = await createExecSessionToken(DEFAULT_AUDITOR_EMAIL, 'auditor')
    const methods = ['POST', 'PUT', 'PATCH', 'DELETE'] as const
    const targets = [
      '/accounting',
      '/users',
      '/erp/planning',
      '/api/v1/finance/journal-entries',
      '/api/erp/governance',
      '/api/erp/odoo-sync',
      '/api/food-safety/check-in',
      '/api/v1/ai/command',
      '/api/v1/governance/telemetry',
    ]

    for (const method of methods) {
      for (const target of targets) {
        const res = await middleware(
          buildAuthedRequest(target, auditorToken, method, 'application/json'),
        )
        expect(res.status, `Expected 403 for auditor ${method} ${target}`).toBe(403)
        const payload = await res.json()
        expect(payload.error).toBe('Read-only auditor session')
      }
    }
  })

  it('allows auditor read access to executive /erp routes, /accounting, and /reports while denying /users in policy', () => {
    expect(isErpRouteAllowedForRole('auditor', '/erp')).toBe(true)
    expect(isErpRouteAllowedForRole('auditor', '/erp/finance')).toBe(true)
    expect(isErpRouteAllowedForRole('auditor', '/erp/competitors')).toBe(true)
    expect(isErpRouteAllowedForRole('auditor', '/accounting')).toBe(true)
    expect(isErpRouteAllowedForRole('auditor', '/reports')).toBe(true)

    expect(isErpRouteAllowedForRole('auditor', '/users')).toBe(false)
    expect(isErpRouteAllowedForRole('auditor', '/directory')).toBe(false)
    expect(isErpRouteAllowedForRole('auditor', '/roles')).toBe(false)
    expect(isErpRouteAllowedForRole('auditor', '/hr')).toBe(false)
    expect(isErpRouteAllowedForRole('auditor', '/pos')).toBe(false)
  })

  it('redacts personal custodian names, risk classifications, and New Journal Entry button in SSR HTML for auditor', () => {
    const auditorHtml = renderToStaticMarkup(
      React.createElement(VentureAccountingHub, { locale: 'ar', isAuditor: true }),
    )
    expect(auditorHtml).not.toContain('قيد يومية جديد')
    expect(auditorHtml).not.toContain('New Journal Entry')
    expect(auditorHtml).not.toContain('تصنيف المخاطر')
    expect(auditorHtml).not.toContain('ربيع أنيس يحيى')
    expect(auditorHtml).not.toContain('شيلا أمبوس بولبولي')
    expect(auditorHtml).not.toContain('أمجد سمير حسين')
    expect(auditorHtml).not.toContain('شيام حكمت كومار')
    expect(auditorHtml).not.toContain('نادر نزهي البستاني')
    expect(auditorHtml).not.toContain('شكر الله ناصيف')
    expect(auditorHtml).not.toContain('نوشا أسانار')
    expect(auditorHtml).not.toContain('مكتب سند')
    expect(auditorHtml).toContain('وضع المراجع الخارجي')
    expect(auditorHtml).toContain('51,154.950')

    const cfoHtml = renderToStaticMarkup(
      React.createElement(VentureAccountingHub, { locale: 'ar', isAuditor: false }),
    )
    expect(cfoHtml).toContain('قيد يومية جديد')
    expect(cfoHtml).toContain('تصنيف المخاطر')

    const mapped = mapAuditorCustodianDisplay(2, 'ربيع أنيس يحيى', 'Rabih Anis Yahia', true)
    expect(mapped.nameAr).not.toContain('ربيع')
    expect(mapped.nameEn).not.toContain('Rabih')
    expect(redactAuditorPersonalNames('عهدة ربيع أنيس يحيى ومكتب سند للتعقيب', true)).not.toMatch(
      /ربيع|سند/,
    )
  })
})
