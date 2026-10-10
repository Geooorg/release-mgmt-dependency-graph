import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { cspPlugin } from './csp.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'csp.test.ts'],
  },
})
