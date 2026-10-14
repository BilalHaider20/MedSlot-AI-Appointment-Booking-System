import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/testDatabase.js';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/globalSetup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-only-secret-not-for-production',
      // Tests always exercise the rules extractor, even if a real key is configured.
      MISTRAL_API_KEY: '',
    },
  },
});
