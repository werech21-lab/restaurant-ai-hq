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
    // Report screens that duplicate Odoo redirect to /erp (which itself requires authentication in middleware).
    const consolidated = [
      '/erp/sales-scorecard',
      '/dashboard',
      '/erp/sales-analysis',
      '/erp/menu-engineering',
      '/erp/cost-intelligence',
      '/erp/executive-pnl',
      '/erp/execution-hub',
      '/erp/alerts',
      '/automations',
      '/erp/demand-forecast',
    ]
    return consolidated.map((source) => ({
      source,
      destination: '/erp',
      permanent: false,
    }))
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
