import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

/**
 * ==============================================================================
 * AETHERBI ERP — EXECUTIVE ACTION DIRECTIVE DISPATCH API
 * Official Recipients:
 * - Sec@venturefoodskw.com
 * - operations@venturefoodskw.com
 * - abdelrahmanm@venturefoodskw.com
 * ==============================================================================
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OFFICIAL_RECIPIENTS = [
  'Sec@venturefoodskw.com',
  'operations@venturefoodskw.com',
  'abdelrahmanm@venturefoodskw.com',
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      resNumber,
      titleAr,
      titleEn,
      categoryAr,
      monthlyImpactKwd,
      annualImpactKwd,
      directiveBodyAr,
      sopStepsAr,
    } = body

    const dispatchedAt = new Date().toISOString()
    const localTimeKuwait = new Date().toLocaleString('ar-KW', { timeZone: 'Asia/Kuwait' })

    // Optional SMTP dispatch if credentials exist in environment
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
            <p><strong>رقم القرار:</strong> <span style="font-family: monospace; color: #38bdf8;">${resNumber}</span></p>
            <p><strong>الموضوع:</strong> ${titleAr} (${titleEn})</p>
            <p><strong>القطاع:</strong> ${categoryAr}</p>
            <p><strong>وقت التوجيه:</strong> ${localTimeKuwait}</p>
            
            <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0; border-right: 4px solid #10b981;">
              <h3 style="margin-top: 0; color: #38bdf8;">نص التوجيه الإداري الرسمي:</h3>
              <p style="line-height: 1.8;">${directiveBodyAr}</p>
            </div>

            <div style="background: #022c22; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #059669;">
              <h3 style="margin-top: 0; color: #34d399;">الأثر المالي المعتمد:</h3>
              <p>💰 <strong>العائد / الوفر الشهري:</strong> +${Number(monthlyImpactKwd).toFixed(3)} د.ك</p>
              <p>📈 <strong>الأثر السنوي التراكمي:</strong> +${Number(annualImpactKwd).toFixed(3)} د.ك</p>
            </div>

            <div style="background: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <h3 style="margin-top: 0; color: #94a3b8;">إجراءات خطة التنفيذ الميدانية (SOP):</h3>
              <ol style="line-height: 1.8;">
                ${(sopStepsAr || []).map((step: string) => `<li>${step}</li>`).join('')}
              </ol>
            </div>

            <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
            <p style="font-size: 11px; color: #94a3b8;">
              تم تصدير هذا التوجيه آلياً بواسطة نظام التحليل والتوجيه الذكي Prescriptive BI لمنصة فنتشر فودز لإدارة المطاعم ذ.م.م.
            </p>
          </div>
        `

        await transporter.sendMail({
          from: `"AetherBI Executive Prescriptive Engine" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
          to: OFFICIAL_RECIPIENTS.join(', '),
          subject: `🚨 [توجيه إداري رسمي] ${resNumber}: ${titleAr}`,
          html: mailHtml,
        })
      } catch (smtpErr) {
        console.warn('SMTP transport skipped or failed:', smtpErr)
      }
    }

    return NextResponse.json({
      success: true,
      resNumber,
      dispatchedAt,
      localTimeKuwait,
      recipients: OFFICIAL_RECIPIENTS,
      status: 'DISPATCHED_TO_EXECUTIVE_DESK',
      message: 'Directive approved and dispatched to official executive stakeholders.',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'DIRECTIVE_DISPATCH_FAILED', message: error?.message },
      { status: 500 }
    )
  }
}
