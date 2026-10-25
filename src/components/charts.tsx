'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { Theme } from '@/lib/theme'

export const chartSeries = {
  blue: '#58a6ff',
  green: '#3fb950',
  red: '#f85149',
}

export function axisTick(fill: string, size = 12) {
  return { fill, fontSize: size, fontFamily: 'inherit' }
}

export function chartPalette(theme: Theme) {
  if (theme === 'light') {
    return {
      tick: '#5e564c',
      grid: 'rgba(28,24,20,0.08)',
      budget: '#8a8176',
    }
  }
  return {
    tick: '#9d968b',
    grid: 'rgba(255,255,255,0.06)',
    budget: '#6f6a62',
  }
}

export function useCompactChart() {
  const [compact, setCompact] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 640px)')
    const apply = () => setCompact(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])
  return compact
}

export function ChartFrame({ children, className = 'h-72' }: { children: ReactNode; className?: string }) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return (
    <div dir="ltr" className={`mt-5 w-full min-w-0 ${className}`}>
      {ready ? children : <div className="h-full" />}
    </div>
  )
}

export function formatTick(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatAmount(value: number | string | ReadonlyArray<number | string> | undefined) {
  const raw = Array.isArray(value) ? value[0] : value
  const amount = Number(raw)
  return Number.isFinite(amount) ? amount.toLocaleString('en-US') : '—'
}
