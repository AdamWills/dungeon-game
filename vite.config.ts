import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      // The game, the sprite lab (art trial) and the AI call log.
      input: { main: 'index.html', lab: 'lab.html', ailog: 'ailog.html' },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // The floor is big (192x120); tests that generate many floors need the time.
    testTimeout: 60_000,
  },
});
