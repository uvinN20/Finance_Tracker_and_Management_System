import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
  root: repositoryRoot,
  cacheDir: path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules/.vite'),
  plugins: [react()],
  test: {
    include: ['frontend/tests/**/*.test.{js,jsx}'],
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: [
        'frontend/src/context/AuthContext.jsx',
        'frontend/src/pages/Login.jsx',
        'frontend/src/pages/Register.jsx',
        'frontend/src/components/Navbar.jsx',
      ],
      reporter: ['text', 'lcov'],
      reportsDirectory: 'frontend/coverage',
    },
  },
});
