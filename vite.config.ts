import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The floor is big (192x120); tests that generate many floors need the time.
    testTimeout: 60_000,
  },
});
