import { describe, expect, it } from 'vitest'
import { CONTENT_SECURITY_POLICY, cspPlugin } from './csp.ts'

describe('cspPlugin', () => {
  it('only applies to the production build, not to the dev server', () => {
    expect(cspPlugin().apply).toBe('build')
  })

  it('injects the policy as the first tag of <head>', () => {
    const hook = cspPlugin().transformIndexHtml
    if (typeof hook !== 'object' || hook === null || typeof hook.handler !== 'function') throw new Error('no hook')
    const tags = (hook.handler as (html: string) => unknown)('<html></html>')
    expect(tags).toEqual([
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ])
  })

  it('forbids inline scripts, plugins, <base> and foreign connections', () => {
    const directives = new Map(CONTENT_SECURITY_POLICY.split('; ').map((d) => [d.split(' ')[0], d]))
    expect(directives.get('script-src')).toBe("script-src 'self'")
    expect(directives.get('connect-src')).toBe("connect-src 'self'")
    expect(directives.get('object-src')).toBe("object-src 'none'")
    expect(directives.get('base-uri')).toBe("base-uri 'none'")
  })
})
