import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import {
  buildContentSecurityPolicy,
  buildTransportSecurityHeaders,
} from './src/lib/security/headers'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'wger.de' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'http', hostname: '127.0.0.1', port: '54321' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    const environment = process.env.NODE_ENV
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: buildContentSecurityPolicy(environment),
          },
          ...buildTransportSecurityHeaders(environment),
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  webpack: {
    automaticVercelMonitors: true,
    treeshake: { removeDebugLogging: true },
  },
})
