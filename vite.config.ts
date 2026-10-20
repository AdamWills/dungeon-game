import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      // The game, and the sprite lab used for the art trial.
      input: { main: 'index.html', lab: 'lab.html' },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // The floor is big (192x120); tests that generate many floors need the time.
    testTimeout: 60_000,
  },
});
