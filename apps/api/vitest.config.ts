import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * API unit tests (Phase 11 sets the precedent).
 * Unit tests are pure — no DB, no network. E2E (vitest.e2e.config.ts) runs
 * against a real MySQL instance.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@caffenet/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
