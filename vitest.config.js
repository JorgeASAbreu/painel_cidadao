import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['backend/tests/**/*.test.js', 'frontend/src/**/*.test.{js,jsx}'],
    testTimeout: 15000,
  },
});
