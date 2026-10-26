import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    // Next resolves 'server-only' itself; under Vitest it is a no-op.
    alias: { 'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
    // PGlite migrations in beforeEach slow down under full-suite load.
    hookTimeout: 30_000,
  },
});
