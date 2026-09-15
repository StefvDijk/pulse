import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: false,
    // Never inherit `.env.local`/shell production targets in unit tests. Tests
    // that need Supabase receive an inert loopback target and must mock I/O.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'vitest-local-only',
      SUPABASE_SERVICE_ROLE_KEY: 'vitest-local-only',
    },
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/**/*.spec.ts', 'node_modules', '.next', 'pulse', 'tests/e2e/**'],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
