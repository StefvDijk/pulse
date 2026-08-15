export interface SecurityHeader {
  key: string
  value: string
}

export function buildContentSecurityPolicy(environment: string | undefined): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${environment === 'development' ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https://wger.de https://*.supabase.co https://tile.openstreetmap.org",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io http://127.0.0.1:54321 ws://127.0.0.1:54321",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ]

  // Local development is deliberately served over HTTP. WebKit correctly
  // obeys this directive and would otherwise upgrade every JS/CSS request to
  // HTTPS, preventing hydration. Production remains HTTPS-only.
  if (environment === 'production') directives.push('upgrade-insecure-requests')

  return directives.join('; ')
}

export function buildTransportSecurityHeaders(
  environment: string | undefined,
): SecurityHeader[] {
  if (environment !== 'production') return []
  return [
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
  ]
}
