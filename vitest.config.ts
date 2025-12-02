import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Exclude intermittent tests - they are standalone Puppeteer scripts
    // that should be run directly with tsx, not through vitest
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/intermittent/**', 'tests/e2e/**'],
  },
});
