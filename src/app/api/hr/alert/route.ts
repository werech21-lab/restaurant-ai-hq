import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/erp-auth'
import { can } from '@/lib/permissions'
import { prisma } from '@/lib/db'
import { dispatchServerEmail, getSmtpPublicStatus } from '@/lib/email/server-mail'
import { EXCLUSIVE_RADAR_RECIPIENTS, VF_PEOPLE } from '@/lib/vf-contact-directory'
import { deliverWhatsApp } from '@/services/notification.service'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HR_ALERT_RECIPIENTS = [
  ...EXCLUSIVE_RADAR_RECIPIENTS.map((r) => ({
    name: r.name,
    title: r.title,
    email: r.email,
    mobile: r.mobileE164,
    mobileDisplay: r.mobileDisplay,
  })),
  {
    name: 'Sheyam Hekmat',
    title: 'HR & Admin Manager',
    email: 'sheyamh@venturefoodskw.com',
    mobile: '+96597386426',
    mobileDisplay: '+965 97386426',
  },
]

export async function GET() {
  const smtp = await getSmtpPublicStatus()
  const sheyam = VF_PEOPLE.find((p) => /Sheyam/i.test(p.name))
  return NextResponse.json({
    data: {
      smtp,
      recipients: HR_ALERT_RECIPIENTS,
      hrManager: sheyam || {
        name: 'Sheyam Hekmat',
        title: 'HR & Admin Manager',
        email: 'sheyamh@venturefoodskw.com',
        mobile: '97386426',
      },
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || !can(user, 'hr', 'view')) {
      return NextResponse.json({ error: { code: 'forbidden', message: 'HR access required' } }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      kind?: string
      subject?: string
      customNote?: string
      candidateName?: string
      branchName?: string
    }

    const now = Date.now()
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    })

    const urgentDocs: string[] = []
    for (const emp of employees) {
      const checks: Array<[string, Date | null]> = [
        ['Civil ID / Residency (Article 18)', emp.civilIdExpiry],
        ['Municipality Health Card', emp.healthCardExpiry],
        ['PAM Work Permit', emp.workPermitExpiry],
        ['Passport', emp.passportExpiry],
      ]
      for (const [label, dt] of checks) {
        if (!dt) continue
        const days = Math.ceil((dt.getTime() - now) / 86_400_000)
        if (days <= 30) {
          urgentDocs.push(
            `• [${emp.code}] ${emp.name} (${emp.department}) — ${label}: ${dt.toISOString().slice(0, 10)} (${days} days)`,
          )
        }
      }
    }

    const kuwaitStamp = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date())

    const subject =
      body.subject?.trim() ||
      `🚨 Venture Foods HRMS Alert · Residency, Health Cards & Overseas Arrival (${kuwaitStamp})`

    const reportLines = [
      '========================================================================',
      'AetherBI · Venture Foods Restaurant Management W.L.L.',
      'ENTERPRISE HRMS & KUWAIT LABOR LAW COMPLIANCE ALERT',
      `Kuwait Timestamp: ${kuwaitStamp}`,
      'Authorized Recipients:',
      '  1. Abdullah Abdulghafar (Sec@venturefoodskw.com)',
      '  2. Choukrallah Nassif (operations@venturefoodskw.com)',
      '  3. Abdulrahman Mohamed Gamaledin (abdelrahmanm@venturefoodskw.com)',
      '  4. Sheyam Hekmat — HR & Admin Manager (sheyamh@venturefoodskw.com)',
      '========================================================================',
      '',
      body.kind === 'overseas_arrival' && body.candidateName
        ? `✈️ OVERSEAS ARRIVAL ALERT: Candidate ${body.candidateName} (${body.branchName || 'Venture Foods'}) scheduled for Kuwait Airport arrival & Municipality/Biometrics onboarding.`
        : '🛡️ URGENT RESIDENCY (VISA 18), WORK PERMIT & MUNICIPALITY HEALTH CARD RENEWALS:',
      body.customNote ? `Note: ${body.customNote}` : null,
      '',
      `Total Active Staff Monitored: ${employees.length}`,
      `Urgent / Expiring within 30 days: ${urgentDocs.length}`,
      '',
      ...(urgentDocs.length > 0
        ? urgentDocs.slice(0, 45)
        : ['• All monitored employee Civil IDs, PAM work permits, and Municipality cards are within safe windows.']),
      '',
      '------------------------------------------------------------------------',
      'تنبيه منظومة الموارد البشرية والاستقدام الخارجي — شركة فنتشر فودز لإدارة المطاعم ذ.م.م.',
      `إجمالي الموظفين النشطين: ${employees.length} | الحالات العاجلة (أقل من 30 يوماً): ${urgentDocs.length}`,
      'المعتمدون: Sec@venturefoodskw.com · operations@venturefoodskw.com · abdelrahmanm@venturefoodskw.com · sheyamh@venturefoodskw.com',
      '========================================================================',
    ]
      .filter((line): line is string => line !== null)
      .join('\n')

    const toEmails = HR_ALERT_RECIPIENTS.map((r) => r.email)
    const emailResult = await dispatchServerEmail({
      subject,
      text: reportLines,
      to: toEmails,
    })

    const channels = []
    for (const recipient of HR_ALERT_RECIPIENTS) {
      let waOk = false
      try {
        const res = await deliverWhatsApp(recipient.mobile, reportLines.slice(0, 3200))
        waOk = res.ok
      } catch {
        waOk = false
      }
      channels.push({
        name: recipient.name,
        title: recipient.title,
        email: recipient.email,
        mobile: recipient.mobileDisplay,
        emailDelivered: emailResult.ok,
        whatsappDelivered: waOk,
      })
    }

    logger.info('hr_enterprise_alert_dispatched', {
      actorId: user.id,
      emailOk: emailResult.ok,
      recipients: toEmails,
      urgentCount: urgentDocs.length,
    })

    return NextResponse.json({
      data: {
        ok: true,
        emailResult,
        recipients: HR_ALERT_RECIPIENTS,
        channels,
        urgentCount: urgentDocs.length,
        timestamp: kuwaitStamp,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code: 'hr_alert_failed',
          message: error instanceof Error ? error.message : 'HR alert dispatch failed',
        },
      },
      { status: 500 },
    )
  }
}
