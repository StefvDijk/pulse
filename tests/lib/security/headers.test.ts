import { describe, expect, it } from 'vitest'
import {
  buildContentSecurityPolicy,
  buildTransportSecurityHeaders,
} from '@/lib/security/headers'

describe('security headers', () => {
  it('keeps local HTTP assets loadable in development', () => {
    expect(buildContentSecurityPolicy('development')).not.toContain(
      'upgrade-insecure-requests',
    )
    expect(buildTransportSecurityHeaders('development')).toEqual([])
  })

  it('enforces HTTPS transport in production', () => {
    expect(buildContentSecurityPolicy('production')).toContain('upgrade-insecure-requests')
    expect(buildTransportSecurityHeaders('production')).toEqual([
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      },
    ])
  })
})
