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
    // No public marketing landing page: aetherbi.com opens the Aether BI workspace directly.
    // Four executive pillars: /erp, /erp/feryal-ai, /erp/aggregator-radar (permanent), /erp/events-intelligence.
    // Report screens that duplicate Odoo redirect to the playbook. /erp/aggregator-radar is never redirected.
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
    return [
      { source: '/', destination: '/erp', permanent: false },
      ...consolidated.map((source) => ({ source, destination: '/erp', permanent: false })),
    ]
  },
  async rewrites() {
    // Canonical P&L lives at /reports?tab=pnl; keep /reports/pnl as a stable alias (200).
    return [{ source: '/reports/pnl', destination: '/reports?tab=pnl' }]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders({
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          isProduction: process.env.NODE_ENV === 'production',
        }),
      },
    ]
  },
}

module.exports = nextConfig
