import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    // Run test files sequentially to avoid database conflicts
    fileParallelism: false,
  },
});
