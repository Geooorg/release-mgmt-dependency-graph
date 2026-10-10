import type { Plugin } from 'vite'

/**
 * `style-src` needs 'unsafe-inline' because React and React Flow set `style` attributes (node sizes, colours).
 * `frame-ancestors` is ignored in a <meta> tag; it can only be sent as an HTTP header by the web server.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/** Adds the CSP as <meta> to the built `index.html` only: the dev server injects inline scripts (HMR) that it would block. */
export function cspPlugin(): Plugin {
  return {
    name: 'release-management:csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        },
      ],
    },
  }
}
