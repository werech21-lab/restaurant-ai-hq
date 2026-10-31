'use client'

import { useEffect, useState } from 'react'
import { ApiError, apiRequest, errorKey, newIdempotencyKey } from '@/components/erp/api'
import { PermissionProvider, useCan } from '@/components/erp/permissions'
import { errorClass, inputClass, labelClass, noticeClass, panelClass, primaryButton, secondaryButton } from '@/components/erp/styles'
import { permissions } from '@/lib/auth/permissions'
import { useI18n, type MessageKey } from '@/lib/i18n'
import { bpsToInput, formatMinor } from '@/lib/money'
import { ventureBrands, type CompetitorBench, type EscalationCard, type GeoRankSnapshot, type VentureBrandRow } from '@/modules/governance/client'

type Board = { brands: VentureBrandRow[]; snapshots: GeoRankSnapshot[]; competitors: CompetitorBench[]; actions: EscalationCard[] }
const platforms = ['Talabat', 'Keeta', 'Jahez', 'Snoonu', 'Deliveroo'] as const
const zones = ['السالمية', 'شرق/مدينة الكويت', 'حولي', 'الفروانية', 'المهبولة', 'الجهراء', 'العارضية'] as const
const radarTabs = ['rank', 'gap', 'tactics', 'escalation'] as const
type RadarTab = (typeof radarTabs)[number]

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
  const [board, setBoard] = useState<Board>({ brands: [], snapshots: [], competitors: [], actions: [] })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<RadarTab>('rank')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash === 'gap' || hash === 'tactics' || hash === 'escalation' || hash === 'rank') setTab(hash)
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

  if (phase === 'loading' && board.snapshots.length === 0) return <p className="text-sm text-gray-400">{t('agg.loading')}</p>
  if (phase === 'error' && board.snapshots.length === 0) return <p className={errorClass} role="alert">{detail ?? t(error)}</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">{t('erpnav.aggregator')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">{t('hub.aggregator')}</p>
      </header>
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
