/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pg'],
    instrumentationHook: true,
  },
};

module.exports = nextConfig;
