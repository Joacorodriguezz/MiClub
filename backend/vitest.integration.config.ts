import { defineConfig } from 'vitest/config';

/**
 * Tests de integración: requieren un Postgres con las migraciones aplicadas
 * (`DATABASE_URL`). Se corren con `npm run test:integration`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    cache: false,
  },
});
