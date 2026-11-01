'use client'

import { useEffect, useState } from 'react'
import { ApiError, apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { bpsToInput, formatMinor } from '@/lib/money'
import { auditAggregatorSettlement, settlementFromSnapshot } from '@/modules/governance/domain/commission-auditor'
import { ventureBrands, type CompetitorBench, type EscalationCard, type GeoRankSnapshot, type VentureBrandRow } from '@/modules/governance/client'

type ExclusiveRecipient = {
  id: string
  name: string
  title: string
  email: string
  mobile: string
  mobileE164: string
  ext: string
  direct: string | null
  channels: string
}
type Board = {
  brands: VentureBrandRow[]
  snapshots: GeoRankSnapshot[]
  competitors: CompetitorBench[]
  actions: EscalationCard[]
  exclusiveAlertRecipients?: ExclusiveRecipient[]
}
const platforms = ['Talabat', 'Keeta', 'Jahez', 'Snoonu', 'Deliveroo', 'Cari'] as const
const zones = ['السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء', 'العارضية'] as const
const radarTabs = ['rank', 'gap', 'tactics', 'escalation', 'settle'] as const
type RadarTab = (typeof radarTabs)[number]

const FALLBACK_RECIPIENTS: ExclusiveRecipient[] = [
  {
    id: 'abdullah-abdulghafar',
    name: 'Abdullah Abdulghafar',
    title: 'Executive Secretary',
    email: 'Sec@venturefoodskw.com',
    mobile: '+965 97386418',
    mobileE164: '+96597386418',
    ext: '102',
    direct: '22469500',
    channels: 'Active: WhatsApp + Telegram + Email',
  },
  {
    id: 'choukrallah-nassif',
    name: 'Choukrallah Nassif',
    title: 'Operations Manager',
    email: 'operations@venturefoodskw.com',
    mobile: '+965 90061400',
    mobileE164: '+96590061400',
    ext: '120',
    direct: null,
    channels: 'Active: WhatsApp + Telegram + Email',
  },
  {
    id: 'abdulrahman-mohamed',
    name: 'Abdulrahman Mohamed Gamaledin',
    title: 'Marketing Coordinator',
    email: 'abdelrahmanm@venturefoodskw.com',
    mobile: '+965 90998227',
    mobileE164: '+96590998227',
    ext: '130',
    direct: null,
    channels: 'Active: WhatsApp + Telegram + Email',
  },
]

function Workspace() {
  const { t } = useI18n()
  const canManage = useCan(permissions.govAggregatorManage)
  const [platform, setPlatform] = useState('')
  const [zone, setZone] = useState('')
  const [branch, setBranch] = useState('')
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<MessageKey>('erp.err.generic')
  const [detail, setDetail] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [board, setBoard] = useState<Board>({ brands: [], snapshots: [], competitors: [], actions: [], exclusiveAlertRecipients: FALLBACK_RECIPIENTS })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<RadarTab>('rank')
  const [reloadToken, setReloadToken] = useState(0)
  const [testBusy, setTestBusy] = useState(false)
  const [testLinks, setTestLinks] = useState<Array<{ name: string; whatsapp: string; telegram: string; email: string }> | null>(null)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash === 'gap' || hash === 'tactics' || hash === 'escalation' || hash === 'rank' || hash === 'settle') setTab(hash)
  }, [])

  function openTab(value: RadarTab) {
    setTab(value)
    window.history.replaceState(null, '', `#${value}`)
  }

  function fail(caught: unknown) {
    if (caught instanceof ApiError) {
      setDetail(caught.message)
      setError('erp.err.generic')
      return
    }
    setDetail(null)
    setError(errorKey(caught))
  }

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (platform) params.set('platform', platform)
    if (zone) params.set('zone', zone)
    if (branch) params.set('branch', branch)
    setPhase('loading')
    apiRequest<{ data: Board }>(`/api/v1/governance/aggregator?${params.toString()}`, { signal: controller.signal })
      .then((page) => {
        setBoard(page.data)
        setSelectedId((current) => (current && page.data.snapshots.some((row) => row.id === current) ? current : page.data.snapshots[0]?.id ?? null))
        setPhase('ready')
        setDetail(null)
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return
        if (caught instanceof ApiError) {
          setDetail(caught.message)
          setError('erp.err.generic')
        } else {
          setDetail(null)
          setError(errorKey(caught))
        }
        setPhase('error')
      })
    return () => controller.abort()
  }, [platform, zone, branch, reloadToken])

  // Live 5-minute radar refresh (same cadence as the governance scan engine).
  useEffect(() => {
    const timer = window.setInterval(() => setReloadToken((value) => value + 1), 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  const selected = board.snapshots.find((row) => row.id === selectedId) ?? null
  const rivals = selected ? board.competitors.filter((row) => row.snapshotId === selected.id) : []
  const cards = board.actions.filter((row) => !selected || (row.platformName === selected.platformName && row.geoZoneAr === selected.geoZoneAr && row.ourBranchName === selected.ourBranchName))
  const activeBrand = ventureBrands.find((item) => item.nameAr === branch) ?? null
  const liveBrand = activeBrand ? board.brands.find((item) => item.code === activeBrand.code) ?? null : null

  async function scan() {
    setBusy(true)
    setNotice(null)
    try {
      const result = await apiRequest<{ data: { recorded: number } }>('/api/v1/governance/aggregator/scans', {
        method: 'POST',
        body: {},
        idempotencyKey: newIdempotencyKey(),
      })
      setNotice(result.data.recorded > 0 ? t('agg.saved') : t('agg.same'))
      setReloadToken((value) => value + 1)
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  async function execute(card: EscalationCard) {
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/api/v1/governance/aggregator/actions/${card.id}`, {
        method: 'POST',
        body: { action: 'execute', version: card.version },
        idempotencyKey: newIdempotencyKey(),
      })
      setNotice(t('agg.saved'))
      setReloadToken((value) => value + 1)
    } catch (caught) {
      fail(caught)
    } finally {
      setBusy(false)
    }
  }

  async function sendTestAlert() {
    setTestBusy(true)
    setNotice(null)
    setTestLinks(null)
    try {
      const result = await apiRequest<{
        data: {
          channels: Array<{ name: string; whatsapp: { href: string }; telegram: { href: string }; emailChannel: { href: string } }>
        }
      }>('/api/v1/governance/aggregator/alerts/test', {
        method: 'POST',
        body: {},
        idempotencyKey: newIdempotencyKey(),
      })
      const links = result.data.channels.map((row) => ({
        name: row.name,
        whatsapp: row.whatsapp.href,
        telegram: row.telegram.href,
        email: row.emailChannel.href,
      }))
      setTestLinks(links)
      setNotice(t('agg.alert.test.ok'))
      for (const link of links) {
        if (link.whatsapp) window.open(link.whatsapp, '_blank', 'noopener,noreferrer')
      }
      const firstTg = links.find((row) => row.telegram)?.telegram
      if (firstTg) window.open(firstTg, '_blank', 'noopener,noreferrer')
      const firstMail = links.find((row) => row.email)?.email
      if (firstMail) window.location.href = firstMail
    } catch (caught) {
      fail(caught)
    } finally {
      setTestBusy(false)
    }
  }

  const recipients = board.exclusiveAlertRecipients?.length ? board.exclusiveAlertRecipients : FALLBACK_RECIPIENTS

  if (phase === 'loading' && board.snapshots.length === 0) return <p className="text-sm text-gray-400">{t('agg.loading')}</p>
  if (phase === 'error' && board.snapshots.length === 0) return <p className={errorClass} role="alert">{detail ?? t(error)}</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('erpnav.aggregator')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{t('hub.aggregator')}</p>
      </header>

      <section className="rounded-2xl border border-emerald-400/30 bg-emerald-950/40 p-4 shadow-[0_0_40px_rgba(16,185,129,0.08)]" aria-labelledby="radar-alert-recipients">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="radar-alert-recipients" className="text-base font-bold text-emerald-100">
              {t('agg.alert.recipients.title')}
            </h2>
            <p className="mt-1 text-xs text-emerald-200/80">{t('agg.alert.recipients.lead')}</p>
          </div>
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
            🟢 Active: WhatsApp + Telegram + Email
          </span>
        </div>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {recipients.map((person) => (
            <li key={person.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-gray-100">
              <p className="font-semibold text-white">{person.name}</p>
              <p className="text-xs text-gray-400">{person.title}{person.ext ? ` · EXT ${person.ext}` : ''}</p>
              <p className="mt-2" dir="ltr">
                <a className="text-emerald-300 underline-offset-2 hover:underline" href={`mailto:${person.email}`}>
                  {person.email}
                </a>
              </p>
              <p className="mt-1 font-medium tracking-wide text-gold-300" dir="ltr">
                {person.mobile}
              </p>
            </li>
          ))}
        </ul>
        {canManage ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={primaryButton} type="button" disabled={testBusy || busy} onClick={() => void sendTestAlert()}>
              {testBusy ? t('agg.alert.test.sending') : t('agg.alert.test')}
            </button>
            <p className="text-xs text-gray-400">{t('agg.alert.recipients.lock')}</p>
          </div>
        ) : null}
        {testLinks ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {testLinks.map((link) => (
              <span key={link.name} className="rounded-lg border border-white/10 px-2 py-1 text-gray-300">
                {link.name}:{' '}
                {link.whatsapp ? (
                  <a className="text-emerald-300" href={link.whatsapp} target="_blank" rel="noreferrer">
                    WA
                  </a>
                ) : null}
                {' · '}
                {link.telegram ? (
                  <a className="text-sky-300" href={link.telegram} target="_blank" rel="noreferrer">
                    TG
                  </a>
                ) : null}
                {' · '}
                {link.email ? (
                  <a className="text-amber-200" href={link.email}>
                    Email
                  </a>
                ) : null}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {notice ? <p className={noticeClass}>{notice}</p> : null}
      {detail ? <p className={errorClass} role="alert">{detail}</p> : null}
      {activeBrand ? (
        <p className="text-sm text-gray-300">
          {t('agg.cuisine')}: {liveBrand?.cuisineCategoryAr ?? activeBrand.cuisineAr}
          {' · '}
          {t('agg.branches')} {liveBrand?.activeBranchesCount ?? activeBrand.branches}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div role="toolbar" aria-label={t('agg.brand')} className="flex flex-wrap items-center gap-2">
          <span className={labelClass}>{t('agg.brand')}</span>
          <button
            type="button"
            aria-pressed={branch === ''}
            onClick={() => setBranch('')}
            className={`rounded-full border px-3 py-1.5 text-sm ${branch === '' ? 'border-gold-300 bg-gold-400/15 font-semibold text-gold-300' : 'border-white/15 text-gray-300'}`}
          >
            {t('agg.brands.all')}
          </button>
          {ventureBrands.map((item) => (
            <button
              key={item.code}
              type="button"
              aria-pressed={branch === item.nameAr}
              onClick={() => setBranch(item.nameAr)}
              className={`rounded-full border px-3 py-1.5 text-sm ${branch === item.nameAr ? 'border-gold-300 bg-gold-400/15 font-semibold text-gold-300' : 'border-white/15 text-gray-300'}`}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
        <label className={labelClass}>{t('agg.platform')}
          <select className={inputClass} value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="">{t('agg.all')}</option>
            {platforms.map((item) => <option key={item} value={item}>{t(`agg.platform.${item}` as MessageKey)}</option>)}
          </select>
        </label>
        <label className={labelClass}>{t('agg.zone')}
          <select className={inputClass} value={zone} onChange={(event) => setZone(event.target.value)}>
            <option value="">{t('agg.all')}</option>
            {zones.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {canManage ? <button className={primaryButton} type="button" disabled={busy} onClick={() => void scan()}>{t('agg.scan')}</button> : null}
      </div>

      <div role="tablist" aria-label={t('erpnav.aggregator')} className="flex flex-wrap gap-1 border-b border-white/10">
        {radarTabs.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`agg-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`agg-panel-${value}`}
            onClick={() => openTab(value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === value ? 'border-gold-300 font-semibold text-gold-300' : 'border-transparent text-gray-400'}`}
          >
            {t(`agg.panel.${value}` as MessageKey)}
          </button>
        ))}
      </div>

      <section className={panelClass} id="rank" role="tabpanel" hidden={tab !== 'rank'} aria-labelledby="agg-tab-rank">
        <h2 className="mb-3 font-semibold text-white">{t('agg.panel.rank')}</h2>
        {board.snapshots.length === 0 ? <p className="text-sm text-gray-400">{t('agg.empty')}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm text-gray-100">
              <thead className="text-gray-400">
                <tr>
                  <th className="px-2 py-2 text-start">{t('agg.col.brand')}</th>
                  <th className="px-2 py-2 text-start">{t('agg.col.branch')}</th>
                  <th className="px-2 py-2 text-start">{t('agg.platform')}</th>
                  <th className="px-2 py-2 text-start">{t('agg.col.coverage')}</th>
                  <th className="px-2 py-2 text-start">{t('agg.rank')}</th>
                  <th className="px-2 py-2 text-start">{t('agg.col.demand')}</th>
                  <th className="px-2 py-2 text-start">{t('agg.col.logistics')}</th>
                </tr>
              </thead>
              <tbody>
                {board.snapshots.map((row) => (
                  <tr key={row.id} className={row.id === selectedId ? 'bg-white/5' : undefined} onClick={() => setSelectedId(row.id)}>
                    <td className="px-2 py-2">{row.brandNameAr} <span dir="ltr">({row.brandNameEn})</span></td>
                    <td className="px-2 py-2">{row.branchLocationAr}</td>
                    <td className="px-2 py-2">{t(`agg.platform.${row.platformName}` as MessageKey)}</td>
                    <td className="px-2 py-2">
                      <span>{row.coveredDeliveryZonesAr}</span>
                      <span className={`mt-1 block w-fit rounded-full px-2 py-0.5 text-[11px] ${row.deliveryZoneStatus === 'مفتوح للتوصيل' ? 'bg-emerald-900/60 text-emerald-200' : row.deliveryZoneStatus === 'خارج نطاق التوصيل' ? 'bg-red-950/70 text-red-100' : 'bg-amber-900/60 text-amber-100'}`}>
                        {t(row.deliveryZoneStatus === 'مفتوح للتوصيل' ? 'agg.zoneStatus.open' : row.deliveryZoneStatus === 'خارج نطاق التوصيل' ? 'agg.zoneStatus.closed' : 'agg.zoneStatus.tight')}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span>#{row.currentRank}</span>
                      <span className={`mt-1 block ${row.rankDelta > 0 ? 'text-emerald-300' : row.rankDelta < 0 ? 'text-red-300' : 'text-gray-400'}`}>
                        {row.rankDelta > 0 ? `▲ +${row.rankDelta}` : row.rankDelta < 0 ? `▼ ${row.rankDelta}` : '0'}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      <span>{t('agg.visits')} {row.estimatedVisitsImpressions}</span>
                      <span className="mt-1 block">{t('agg.conversion')} {bpsToInput(row.conversionRateBps)}</span>
                      <span className="mt-1 block">{t('agg.rating')} {bpsToInput(row.overallRatingBps)}</span>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] ${row.logisticsMode === 'platform_fleet' ? 'bg-emerald-900/60 text-emerald-200' : 'bg-amber-900/60 text-amber-100'}`}>
                        {row.logisticsMode === 'platform_fleet' ? t('agg.fleet.platform') : t('agg.fleet.vendor')}
                      </span>
                      <span className="mt-1 block">{t('agg.prep')} {row.prepTimeMinutes} {t('agg.minutes')}</span>
                      <span className="mt-1 block">{row.deliveryEtaMinutes} {t('agg.minutes')}</span>
                      <span className="mt-1 block">{formatMinor(row.deliveryFeeMinor)} {t('admin.kwd')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selected?.algorithmPenaltyReasonAr ? (
          <p role="alert" className="mt-3 rounded-xl border border-red-400/50 bg-red-950/50 px-3 py-2 text-sm text-red-100">{selected.algorithmPenaltyReasonAr}</p>
        ) : null}
      </section>

      <section className={panelClass} id="gap" role="tabpanel" hidden={tab !== 'gap'} aria-labelledby="agg-tab-gap">
        <h2 className="mb-3 font-semibold text-white">{t('agg.panel.gap')}</h2>
        {!selected ? <p className="text-sm text-gray-400">{t('agg.empty')}</p> : (
          <div className="grid gap-3 md:grid-cols-4">
            <article className="rounded-xl border border-white/10 p-3 text-sm text-gray-100">
              <p className="text-gray-400">{t('agg.ours')}</p>
              <p className="mt-1 font-semibold">#{selected.currentRank} {selected.ourBrandName}</p>
              <p>{selected.ourBranchName}</p>
              <p>{selected.deliveryEtaMinutes} {t('agg.minutes')}</p>
              <p>{formatMinor(selected.deliveryFeeMinor)} {t('admin.kwd')}</p>
              <p>{selected.logisticsMode === 'platform_fleet' ? t('agg.fleet.platform') : t('agg.fleet.vendor')}</p>
              <p>{t('agg.rating')} {bpsToInput(selected.overallRatingBps)}</p>
              <p>{t('agg.conversion')} {bpsToInput(selected.conversionRateBps)}</p>
            </article>
            {rivals.map((row) => (
              <article key={row.id} className="rounded-xl border border-white/10 p-3 text-sm text-gray-100">
                <p className="text-gray-400">#{row.competitorRank} {row.competitorBrandName}</p>
                <p className="mt-1">{t('agg.gap.eta')}: {row.gap.etaGapMinutes}</p>
                <p>{t('agg.gap.fee')}: {formatMinor(row.gap.feeGapMinor)} {t('admin.kwd')}</p>
                <p>{t('agg.gap.rating')}: {bpsToInput(Math.max(0, row.gap.ratingGapBps))}</p>
                <p>{t('agg.gap.rank')}: {row.gap.rankGap}</p>
                <p>{row.competitorLogisticsMode === 'platform_fleet' ? t('agg.fleet.platform') : t('agg.fleet.vendor')}</p>
                <p>{t('agg.visits')} {row.competitorVisitsEstimate}</p>
                <p>{t('agg.conversion')} {bpsToInput(row.competitorConversionBps)}</p>
                {row.exactGapAnalysisAr ? <p className="mt-1 text-gray-300">{row.exactGapAnalysisAr}</p> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={panelClass} id="tactics" role="tabpanel" hidden={tab !== 'tactics'} aria-labelledby="agg-tab-tactics">
        <h2 className="mb-3 font-semibold text-white">{t('agg.panel.tactics')}</h2>
        {rivals.length === 0 ? <p className="text-sm text-gray-400">{t('agg.empty')}</p> : rivals.map((row) => (
          <article key={row.id} className="border-t border-white/10 py-3 text-sm text-gray-100">
            <p className="font-semibold">#{row.competitorRank} {row.competitorBrandName} — {row.activePromoBadgeAr}</p>
            <p className="mt-1 text-gray-300">{row.detectedRatingBoostPolicyAr}</p>
            <p className="mt-1">{t('agg.rating')} {bpsToInput(row.competitorRatingBps)} — {t('agg.reviews')} {row.competitorReviewsCount}</p>
            <p className="mt-1">{t('agg.visits')} {row.competitorVisitsEstimate} — {t('agg.conversion')} {bpsToInput(row.competitorConversionBps)}</p>
          </article>
        ))}
      </section>

      <section className={panelClass} id="escalation" role="tabpanel" hidden={tab !== 'escalation'} aria-labelledby="agg-tab-escalation">
        <h2 className="mb-3 font-semibold text-white">{t('agg.panel.escalation')}</h2>
        {cards.length === 0 ? <p className="text-sm text-gray-400">{t('agg.empty')}</p> : cards.map((card) => (
          <article key={card.id} className="border-t border-white/10 py-3 text-sm text-gray-100">
            <p className="font-semibold">{card.ourBrandName || card.ourBranchName} — {t(`agg.platform.${card.platformName}` as MessageKey)} — {card.geoZoneAr}</p>
            <p className="mt-1">#{card.currentRank} → #{card.targetRank} · {t(`agg.status.${card.status}` as MessageKey)}</p>
            <p className="mt-1">{card.penaltyDiagnosedAr || card.rootCauseAr}</p>
            <p className="mt-1">{card.stepByStepPlanAr || card.recommendationAr}</p>
            {card.logisticsSwitchAr ? <p className="mt-1">{card.logisticsSwitchAr}</p> : null}
            {card.ratingBoostTacticAr ? <p className="mt-1">{card.ratingBoostTacticAr}</p> : null}
            <p className="mt-1">{t('agg.daily')} {card.estimatedDailyOrdersGain} — {t('agg.monthly')} {formatMinor(card.estimatedMonthlyRevenueUpliftMinor || card.estimatedRevenueUpliftMinor)} {t('admin.kwd')}</p>
            {canManage && card.status === 'pending' ? (
              <button className={`${secondaryButton} mt-2`} type="button" disabled={busy} onClick={() => void execute(card)}>{t('agg.execute')}</button>
            ) : null}
          </article>
        ))}
      </section>

      <section className={panelClass} id="settle" role="tabpanel" hidden={tab !== 'settle'} aria-labelledby="agg-tab-settle">
        <h2 className="mb-1 font-semibold text-white">{t('agg.panel.settle')}</h2>
        <p className="mb-3 text-sm text-gray-400">{t('agg.settle.lead')}</p>
        {!selected ? <p className="text-sm text-gray-400">{t('agg.empty')}</p> : (() => {
          const audit = auditAggregatorSettlement(settlementFromSnapshot({
            deliveryFeeMinor: selected.deliveryFeeMinor,
            logisticsMode: selected.logisticsMode,
            currentRank: selected.currentRank,
            pageViews: selected.estimatedVisitsImpressions,
            ordersCount: Math.round((selected.estimatedVisitsImpressions * selected.conversionRateBps) / 10_000),
            avgTicketMinor: Math.max(selected.minOrderMinor, selected.deliveryFeeMinor * 8),
            commissionBps: 2500,
          }))
          return (
            <div className="grid gap-3 md:grid-cols-3">
              <article className="rounded-xl border border-white/10 p-3 text-sm text-gray-100">
                <p className="text-gray-400">{t('agg.settle.platform')}</p>
                <p className="mt-2 text-lg font-semibold text-gold-300">{formatMinor(audit.platformNetMarginMinor)} {t('admin.kwd')}</p>
                <p className="mt-1 text-xs text-gray-400">{t('agg.settle.margin')}</p>
              </article>
              <article className="rounded-xl border border-white/10 p-3 text-sm text-gray-100">
                <p className="text-gray-400">{t('agg.settle.fleet')}</p>
                <p className="mt-2 text-lg font-semibold text-gold-300">{formatMinor(audit.fleetNetMarginMinor)} {t('admin.kwd')}</p>
                <p className="mt-1 text-xs text-gray-400">{t('agg.settle.better')}: {audit.better === 'fleet' ? t('agg.settle.fleet') : audit.better === 'platform' ? t('agg.settle.platform') : '—'}</p>
              </article>
              <article className="rounded-xl border border-white/10 p-3 text-sm text-gray-100">
                <p className="text-gray-400">{t('agg.settle.rankTrack')}</p>
                <p className="mt-2 text-lg font-semibold text-white">{audit.rankTrackLabel}</p>
                <p className="mt-3 text-gray-400">{t('agg.settle.funnel')}</p>
                <p className="mt-1">{t('agg.settle.visits')}: {selected.estimatedVisitsImpressions}</p>
                <p>{t('agg.settle.conversion')}: {bpsToInput(audit.conversionBps)}</p>
              </article>
            </div>
          )
        })()}
      </section>
    </div>
  )
}

export default function AggregatorRadar({ permissions: granted }: { permissions: readonly string[] }) {
  return (
    <PermissionProvider permissions={granted}>
      <Workspace />
    </PermissionProvider>
  )
}
