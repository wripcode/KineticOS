import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      // Pure math / logic tests — no DOM needed
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/physics.test.ts',
            'src/webgl/resource-manager.test.ts',
          ],
        },
      },
      // Tests that need DOM APIs (document, canvas, etc.)
      {
        test: {
          name: 'dom',
          environment: 'happy-dom',
          pool: 'vmForks',
          include: [
            'src/config.test.ts',
            'src/effects/image-particle/image-processing.test.ts',
          ],
        },
      },
    ],
  },
});
