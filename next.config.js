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
    const specific = [
      { source: '/erp/delivery-control', destination: '/erp/aggregator-radar' },
      { source: '/erp/recipes', destination: '/erp/cores' },
      { source: '/recipes', destination: '/erp/cores' },
      { source: '/inventory', destination: '/erp/warehouse-chain' },
      { source: '/warehouses', destination: '/erp/warehouse-chain' },
      { source: '/purchases', destination: '/erp/warehouse-chain' },
      { source: '/sales', destination: '/erp/cores' },
    ]
    return [
      ...toErp.map((source) => ({ source, destination: '/erp', permanent: false })),
      ...specific.map((entry) => ({ ...entry, permanent: false })),
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
