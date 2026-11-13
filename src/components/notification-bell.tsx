'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, Refrigerator, Radar, IdCard, Package, X } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export type AlertItem = {
  id: string
  name: string
  code: string
  stockLabel: string
  reorderLabel: string
}

export type NoticeItem = {
  id: string
  title: string
  body: string
  href: string
  category?: 'radar' | 'food' | 'hr' | 'stock' | 'all'
  createdAt?: string
}

type TabId = 'all' | 'radar' | 'food' | 'hr'

type UnifiedNotice = {
  id: string
  title: string
  body: string
  href: string
  category: TabId | 'stock'
  createdAt: string
  read: boolean
}

const READ_KEY = 'vf_notif_read_ids'

function loadReadIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(READ_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-200)))
  } catch {
    // ignore
  }
}

function categoryIcon(category: UnifiedNotice['category']) {
  if (category === 'radar') return <Radar size={16} className="text-red-300" />
  if (category === 'food') return <Refrigerator size={16} className="text-cyan-300" />
  if (category === 'hr') return <IdCard size={16} className="text-amber-300" />
  return <Package size={16} className="text-emerald-300" />
}

function classifyHref(href: string): UnifiedNotice['category'] {
  if (href.includes('aggregator-radar') || href.includes('delivery')) return 'radar'
  if (href.includes('food-safety') || href.includes('stock-count') || href.includes('central-kitchen')) return 'food'
  if (href.includes('/hr') || href.includes('compliance')) return 'hr'
  if (href.includes('inventory')) return 'stock'
  return 'stock'
}

export function NotificationBell({
  count,
  items,
  notices = [],
}: {
  count: number
  items: AlertItem[]
  notices?: NoticeItem[]
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabId>('all')
  const [mounted, setMounted] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 56, left: 16, width: 384 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { locale, dir } = useI18n()
  const en = locale === 'en'
  const rtl = dir === 'rtl'

  useEffect(() => {
    setMounted(true)
    setReadIds(loadReadIds())
  }, [])

  const placePanel = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const margin = 12
    const sidebar = window.matchMedia('(min-width: 768px)').matches ? 256 : 0
    const width = Math.min(384, Math.max(300, window.innerWidth - margin * 2 - 8))
    const gap = 10
    let left: number
    if (rtl) {
      // Bell sits on the free (left) edge in RTL header — align panel to bell's end, keep clear of right sidebar.
      left = rect.right - width
      const maxLeft = window.innerWidth - sidebar - width - margin
      left = Math.min(left, maxLeft)
      left = Math.max(margin, left)
    } else {
      // Bell sits on the free (right) edge in LTR header — open leftward into content, never under left sidebar.
      left = rect.right - width
      left = Math.max(sidebar + margin, left)
      left = Math.min(left, window.innerWidth - width - margin)
      left = Math.max(margin, left)
    }
    const top = Math.min(rect.bottom + gap, Math.max(margin, window.innerHeight - 120))
    setCoords({ top, left, width })
  }, [rtl])

  useEffect(() => {
    if (!open) return
    placePanel()
    const onResize = () => placePanel()
    const onScroll = () => placePanel()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (btnRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
    }
  }, [open, placePanel])

  const unified = useMemo((): UnifiedNotice[] => {
    const now = new Date().toISOString()
    const executive: UnifiedNotice[] = [
      {
        id: 'exec-radar',
        title: en ? 'Aggregator radar live watch' : 'مراقبة رادار التوصيل الحية',
        body: en
          ? 'Forced Offline / TGO 17% detector is armed for all 6 brands • 7 branches • 8 channels.'
          : 'كاشف الإغلاق القسري وتحويل توصيل المنصة 17% مفعّل عبر 6 مطاعم • 7 فروع • 8 قنوات.',
        href: '/erp/aggregator-radar',
        category: 'radar',
        createdAt: now,
        read: false,
      },
      {
        id: 'exec-food',
        title: en ? 'Cold-chain & FEFO shelf-life' : 'سلسلة التبريد وصلاحية FEFO',
        body: en
          ? 'Open the food-safety hub for fridge telemetry and expiry countdown.'
          : 'افتح مركز سلامة الغذاء لمراقبة البرادات وعدّاد الصلاحية.',
        href: '/erp/food-safety',
        category: 'food',
        createdAt: now,
        read: false,
      },
      {
        id: 'exec-hr',
        title: en ? 'Residence / HR compliance radar' : 'رادار الإقامات والامتثال',
        body: en ? 'Review expiring residencies and compliance flags.' : 'راجع الإقامات المنتهية وتنبيهات الامتثال.',
        href: '/hr/compliance-radar',
        category: 'hr',
        createdAt: now,
        read: false,
      },
    ]

    const stock: UnifiedNotice[] = items.map((item) => ({
      id: `stock-${item.id}`,
      title: item.name,
      body: en
        ? `${item.code} · stock ${item.stockLabel} / ROP ${item.reorderLabel}`
        : `${item.code} · الرصيد ${item.stockLabel} / حد الطلب ${item.reorderLabel}`,
      href: `/inventory?filter=low_stock&q=${encodeURIComponent(item.code)}`,
      category: 'stock' as const,
      createdAt: now,
      read: false,
    }))

    const auto: UnifiedNotice[] = notices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      body: notice.body,
      href: notice.href || '/automations',
      category: notice.category ?? classifyHref(notice.href || ''),
      createdAt: notice.createdAt || now,
      read: false,
    }))

    return [...executive, ...stock, ...auto].map((n) => ({
      ...n,
      read: readIds.has(n.id),
    }))
  }, [items, notices, en, readIds])

  const filtered = useMemo(() => {
    if (tab === 'all') return unified
    if (tab === 'radar') return unified.filter((n) => n.category === 'radar')
    if (tab === 'food') return unified.filter((n) => n.category === 'food' || n.category === 'stock')
    return unified.filter((n) => n.category === 'hr')
  }, [unified, tab])

  const unreadCount = unified.filter((n) => !n.read).length
  const badge = Math.max(count, unreadCount)

  function markRead(id: string) {
    setReadIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      saveReadIds(next)
      return next
    })
  }

  function markAllRead() {
    setReadIds((prev) => {
      const next = new Set(prev)
      for (const n of unified) next.add(n.id)
      saveReadIds(next)
      return next
    })
  }

  const tabs: { id: TabId; en: string; ar: string }[] = [
    { id: 'all', en: 'All', ar: 'الكل' },
    { id: 'radar', en: '🚨 Radar', ar: '🚨 رادار التوصيل' },
    { id: 'food', en: '❄️ Food Safety', ar: '❄️ البرادات والصلاحية' },
    { id: 'hr', en: '🆔 HR', ar: '🆔 الإقامات' },
  ]

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={en ? 'Live Notifications Center' : 'مركز التنبيهات الفورية'}
            className="fixed z-[9999] w-96 max-w-[92vw] max-h-[min(32rem,calc(100vh-5rem))] overflow-hidden rounded-xl border border-emerald-500/30 bg-[#0f141d] shadow-2xl"
            style={{ top: coords.top, left: coords.left, width: coords.width, maxWidth: '92vw' }}
            dir={rtl ? 'rtl' : 'ltr'}
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-black text-white">{en ? 'Live Notifications Center' : 'مركز التنبيهات الفورية'}</p>
                <p className="text-[11px] text-gray-400">
                  {en ? `${unreadCount} unread · Dark Obsidian` : `${unreadCount} غير مقروء · Dark Obsidian`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded-lg border border-white/10 px-2 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-white/5"
                  onClick={markAllRead}
                >
                  {en ? 'Mark all as read' : 'تحديد الكل كمقروء'}
                </button>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-white/5 hover:text-white"
                  aria-label={en ? 'Close' : 'إغلاق'}
                  onClick={() => setOpen(false)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-white/10 px-2 py-2">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                    tab === t.id ? 'bg-emerald-600/30 text-emerald-100' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  {en ? t.en : t.ar}
                </button>
              ))}
            </div>

            <ul className="max-h-[22rem] overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-gray-400">{en ? 'No alerts in this tab.' : 'لا تنبيهات في هذا التبويب.'}</li>
              ) : (
                filtered.map((notice) => (
                  <li key={notice.id} className={`border-b border-white/5 last:border-0 ${notice.read ? 'opacity-60' : ''}`}>
                    <a
                      href={notice.href}
                      className="flex gap-3 px-4 py-3 hover:bg-white/[0.04]"
                      onClick={() => markRead(notice.id)}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30">
                        {categoryIcon(notice.category)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-white">{notice.title}</span>
                          {!notice.read ? <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" /> : null}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-400">{notice.body}</span>
                      </span>
                    </a>
                  </li>
                ))
              )}
            </ul>

            <div className="grid grid-cols-3 gap-1 border-t border-white/10 p-2 text-center text-[11px]">
              <a href="/erp/aggregator-radar" className="rounded-lg px-2 py-2 font-semibold text-red-200 hover:bg-white/5">
                {en ? 'Radar' : 'الرادار'}
              </a>
              <a href="/erp/food-safety" className="rounded-lg px-2 py-2 font-semibold text-cyan-200 hover:bg-white/5">
                {en ? 'Food Safety' : 'سلامة الغذاء'}
              </a>
              <a href="/hr/compliance-radar" className="rounded-lg px-2 py-2 font-semibold text-amber-200 hover:bg-white/5">
                {en ? 'HR Radar' : 'رادار HR'}
              </a>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        className="relative rounded-xl border border-gold-300/20 bg-ink-900 p-2 text-mist-100 hover:border-emerald-400/40 hover:bg-ink-800"
        onClick={() => {
          setOpen((value) => {
            const next = !value
            if (next) queueMicrotask(placePanel)
            return next
          })
        }}
        aria-expanded={open}
        aria-label={en ? 'Live notifications' : 'التنبيهات الفورية'}
      >
        <Bell size={18} />
        {badge > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] leading-none font-bold text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </button>
      {panel}
    </div>
  )
}
