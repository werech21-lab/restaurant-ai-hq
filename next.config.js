const { buildSecurityHeaders } = require('./security-headers')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['pg', '@prisma/client', 'prisma'],
  eslint: {
    // erp-pro print/download screens use <img> for offline/print fidelity
    ignoreDuringBuilds: false,
  },
  async redirects() {
    // Root "/" is enforced directly by src/middleware.ts (unauthenticated -> /login, authenticated -> /erp).
    const toErp = [
      '/dashboard',
      '/erp/execution-hub',
      '/automations',
      '/automation',
      '/erp/prep-sla',
      '/erp/delivery-sla',
      '/erp/social-reviews',
      '/erp/reviews',
      '/erp/competitors',
      '/erp/market',
      '/erp/regulations',
      '/erp/food-safety',
      '/erp/events-projects',
      '/erp/intelligence',
      '/erp/kds',
      '/kds',
      '/crm',
      '/pos',
    ]
    const toWarehouseChain = ['/inventory', '/warehouses', '/purchases']
    const toCores = ['/erp/recipes', '/recipes', '/sales']
    return [
      ...toErp.map((source) => ({ source, destination: '/erp', permanent: false })),
      { source: '/erp/demand-forecast', destination: '/erp/planning', permanent: false },
      { source: '/erp/delivery-control', destination: '/erp/aggregator-radar', permanent: false },
      ...toCores.map((source) => ({ source, destination: '/erp/cores', permanent: false })),
      ...toWarehouseChain.map((source) => ({
        source,
        destination: '/erp/warehouse-chain',
        permanent: false,
      })),
    ]
  },
  async rewrites() {
    // Canonical P&L lives at /reports?tab=pnl; keep /reports/pnl as a stable alias (200).
    return [{ source: '/reports/pnl', destination: '/reports?tab=pnl' }]
  },
  async headers() {
    const sharedHeaders = [
      ...buildSecurityHeaders({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        isProduction: process.env.NODE_ENV === 'production',
        omitCsp: true,
      }),
      { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
    ]
    return [
      {
        source: '/:path*',
        headers: sharedHeaders,
      },
    ]
  },
}

module.exports = nextConfig
