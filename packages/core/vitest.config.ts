import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      // Pure math / logic tests — no DOM needed
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/physics.test.ts'],
        },
      },
      // Config parsing uses document.createElement — needs jsdom
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/config.test.ts'],
        },
      },
    ],
    // TODO: Fix ESM require issues in JSDOM environment for config.test.ts
    // server: { deps: { inline: true } }
  },
});
