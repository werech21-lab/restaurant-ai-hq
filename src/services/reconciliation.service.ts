/**
 * Smart reconciliation: NBK bank deposits vs delivery platform settlements (TGO 17% / MP 10%).
 */
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export type ReconMatch = {
  id: string
  source: string
  platform: string | null
  channel: 'TGO' | 'MP' | 'BANK' | 'UNKNOWN'
  expectedCommissionBps: number
  gross: number
  commission: number
  net: number
  bankHint: string | null
  status: 'MATCHED' | 'SHORTFALL' | 'OVER_COMMISSION' | 'REVIEW'
  noteAr: string
  noteEn: string
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

export async function runSmartReconciliation(actorId: string) {
  const settlements = await prisma.deliverySettlement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 80,
  })
  const bankAccounts = await prisma.account.findMany({
    where: { OR: [{ code: { contains: '10143' } }, { code: { contains: '10212' } }, { name: { contains: 'NBK' } }, { name: { contains: 'وطني' } }] },
    take: 20,
  })
  const bankHint = bankAccounts.map((a) => `${a.code} ${a.name}`).join(' · ') || '10143 / 10212 NBK'

  const matches: ReconMatch[] = []
  for (const row of settlements) {
    const gross = row.grossAmount
    const commission = row.commissionAmount
    const net = row.netPayout
    const label = `${row.platformCode} ${row.periodLabel} ${row.brandCode || ''}`.toLowerCase()
    const isTgo = /\btgo\b|talabat.?go|aggregator|منصة/.test(label) || (gross > 0 && commission / Math.max(gross, 0.001) > 0.13)
    const isMp = /\bmp\b|marketplace|10%/.test(label) || (gross > 0 && commission / Math.max(gross, 0.001) <= 0.12 && commission / Math.max(gross, 0.001) >= 0.08)
    const channel: ReconMatch['channel'] = isTgo ? 'TGO' : isMp ? 'MP' : 'UNKNOWN'
    const expectedBps = channel === 'TGO' ? 1700 : channel === 'MP' ? 1000 : 0
    const expectedCommission = expectedBps ? round3((gross * expectedBps) / 10_000) : commission
    const expectedNet = round3(gross - expectedCommission)
    let status: ReconMatch['status'] = 'REVIEW'
    let noteAr = 'يحتاج مراجعة يدوية'
    let noteEn = 'Needs manual review'
    if (channel !== 'UNKNOWN') {
      const deltaComm = round3(commission - expectedCommission)
      const deltaNet = round3(net - expectedNet)
      if (Math.abs(deltaComm) <= 0.05 && Math.abs(deltaNet) <= 0.05) {
        status = 'MATCHED'
        noteAr = `مطابق ${channel} · عمولة ${(expectedBps / 100).toFixed(0)}%`
        noteEn = `Matched ${channel} · ${(expectedBps / 100).toFixed(0)}% commission`
      } else if (deltaComm > 0.05) {
        status = 'OVER_COMMISSION'
        noteAr = `عمولة زائدة +${deltaComm.toFixed(3)} د.ك مقابل ${channel}`
        noteEn = `Over-commission +${deltaComm.toFixed(3)} KWD vs ${channel}`
      } else if (deltaNet < -0.05) {
        status = 'SHORTFALL'
        noteAr = `نقص إيداع متوقع ${Math.abs(deltaNet).toFixed(3)} د.ك في ${bankHint}`
        noteEn = `Deposit shortfall ${Math.abs(deltaNet).toFixed(3)} KWD vs ${bankHint}`
      } else {
        status = 'MATCHED'
        noteAr = `ضمن الهامش · ${channel}`
        noteEn = `Within tolerance · ${channel}`
      }
    }

    matches.push({
      id: row.id,
      source: row.periodLabel,
      platform: row.platformCode,
      channel,
      expectedCommissionBps: expectedBps,
      gross: round3(gross),
      commission: round3(commission),
      net: round3(net),
      bankHint,
      status,
      noteAr,
      noteEn,
    })
  }

  // Include recent dept ingest accounting/sales rows as bank statement hints
  try {
    const ingest = await prisma.deptIngestDocument.findMany({
      where: { module: { in: ['accounting', 'sales_delivery'] } },
      orderBy: { createdAt: 'desc' },
      take: 40,
    })
    for (const doc of ingest) {
      const amount = doc.amountMinor != null ? doc.amountMinor / 1000 : 0
      const hay = `${doc.fileName} ${doc.relativePath} ${doc.entityLabel || ''} ${doc.extractedText || ''}`.toLowerCase()
      if (!/nbk|10143|10212|talabat|deliveroo|jahez|keeta|snoonu|وطني|طلبات/.test(hay) && amount <= 0) continue
      matches.push({
        id: doc.id,
        source: doc.fileName,
        platform: doc.entityLabel,
        channel: /talabat|deliveroo|jahez|keeta|snoonu|طلبات/.test(hay) ? (/tgo|17/.test(hay) ? 'TGO' : /mp|10/.test(hay) ? 'MP' : 'UNKNOWN') : 'BANK',
        expectedCommissionBps: /17/.test(hay) ? 1700 : /10/.test(hay) ? 1000 : 0,
        gross: amount,
        commission: 0,
        net: amount,
        bankHint,
        status: 'REVIEW',
        noteAr: 'مستند مرفوع عبر الرفع الذكي — جاهز للمطابقة',
        noteEn: 'Smart-ingest document ready for matching',
      })
    }
  } catch (error) {
    logger.warn('recon_ingest_scan_soft', {
      errorMessage: error instanceof Error ? error.message : String(error),
    })
  }

  try {
    await prisma.activityLog.create({
      data: {
        userId: actorId,
        action: 'SMART_RECONCILIATION',
        module: 'accounting',
        details: JSON.stringify({ matches: matches.length, bankHint }),
      },
    })
  } catch {
    /* non-fatal */
  }

  const summary = {
    total: matches.length,
    matched: matches.filter((m) => m.status === 'MATCHED').length,
    shortfall: matches.filter((m) => m.status === 'SHORTFALL').length,
    overCommission: matches.filter((m) => m.status === 'OVER_COMMISSION').length,
    review: matches.filter((m) => m.status === 'REVIEW').length,
    bankHint,
  }

  return { summary, matches }
}
