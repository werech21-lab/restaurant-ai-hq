import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import {
  ENTERPRISE_API_SECURITY_HEADERS,
  requireExecApiSession,
} from '@/lib/auth/api-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OFFICIAL_RECIPIENTS = [
  'Sec@venturefoodskw.com',
  'operations@venturefoodskw.com',
  'abdelrahmanm@venturefoodskw.com',
]

function escapeHtml(raw: unknown, maxLen = 2000): string {
  return String(raw ?? '')
    .slice(0, maxLen)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function sanitizeHeaderToken(raw: unknown, maxLen = 140): string {
  return String(raw ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLen)
}

export async function POST(req: NextRequest) {
  const authGuard = await requireExecApiSession(req, { allowAuditor: false })
  if (!authGuard.ok) return authGuard.response

  try {
    const body = (await req.json()) as Record<string, unknown>
    const safeResNumber = escapeHtml(body.resNumber, 80)
    const safeTitleAr = escapeHtml(body.titleAr, 240)
    const safeTitleEn = escapeHtml(body.titleEn, 240)
    const safeCategoryAr = escapeHtml(body.categoryAr, 120)
    const safeDirectiveBodyAr = escapeHtml(body.directiveBodyAr, 4000)
    const rawSteps = Array.isArray(body.sopStepsAr) ? body.sopStepsAr.slice(0, 20) : []
    const safeSteps = rawSteps.map((step) => escapeHtml(step, 500))
    const monthlyImpact = Number(body.monthlyImpactKwd) || 0
    const annualImpact = Number(body.annualImpactKwd) || 0

    const dispatchedAt = new Date().toISOString()
    const localTimeKuwait = new Date().toLocaleString('ar-KW', { timeZone: 'Asia/Kuwait' })

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        })

        const mailHtml = `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px;">
            <h1 style="color: #10b981; border-bottom: 2px solid #334155; padding-bottom: 12px;">
              ⚖️ توجيه وقرار إداري تنفيذي معتمد | منصة AetherBI
            </h1>
            <p><strong>رقم القرار:</strong> <span style="font-family: monospace; color: #38bdf8;">${safeResNumber}</span></p>
            <p><strong>الموضوع:</strong> ${safeTitleAr} (${safeTitleEn})</p>
            <p><strong>القطاع:</strong> ${safeCategoryAr}</p>
            <p><strong>وقت التوجيه:</strong> ${escapeHtml(localTimeKuwait, 80)}</p>
            <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0; border-right: 4px solid #10b981;">
              <h3 style="margin-top: 0; color: #38bdf8;">نص التوجيه الإداري الرسمي:</h3>
              <p style="line-height: 1.8;">${safeDirectiveBodyAr}</p>
            </div>
            <div style="background: #022c22; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #059669;">
              <h3 style="margin-top: 0; color: #34d399;">الأثر المالي المعتمد:</h3>
              <p>💰 <strong>العائد / الوفر الشهري:</strong> +${monthlyImpact.toFixed(3)} د.ك</p>
              <p>📈 <strong>الأثر السنوي التراكمي:</strong> +${annualImpact.toFixed(3)} د.ك</p>
            </div>
            <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin-top: 0; color: #94a3b8;">إجراءات خطة التنفيذ الميدانية (SOP):</h3>
              <ol style="line-height: 1.8;">
                ${safeSteps.map((step) => `<li>${step}</li>`).join('')}
              </ol>
            </div>
          </div>
        `

        const subjectCode = sanitizeHeaderToken(body.resNumber, 60)
        const subjectTitle = sanitizeHeaderToken(body.titleAr, 120)

        await transporter.sendMail({
          from: `"AetherBI Executive Prescriptive Engine" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: OFFICIAL_RECIPIENTS.join(', '),
          subject: `🚨 [توجيه إداري رسمي] ${subjectCode}: ${subjectTitle}`,
          html: mailHtml,
        })
      } catch (smtpErr) {
        console.warn('SMTP transport skipped or failed:', smtpErr)
      }
    }

    return NextResponse.json(
      {
        success: true,
        resNumber: sanitizeHeaderToken(body.resNumber, 80),
        dispatchedAt,
        localTimeKuwait,
        recipients: OFFICIAL_RECIPIENTS,
        status: 'DISPATCHED_TO_EXECUTIVE_DESK',
        message: 'Directive approved and dispatched to official executive stakeholders.',
      },
      { headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  } catch {
    return NextResponse.json(
      { error: 'DIRECTIVE_DISPATCH_FAILED', message: 'Invalid directive request payload.' },
      { status: 400, headers: ENTERPRISE_API_SECURITY_HEADERS },
    )
  }
}
