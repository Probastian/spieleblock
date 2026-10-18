import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// Tests der reinen TypeScript-Pakete (shared, games, server). Die Angular-App testet `ng test`.
export default defineConfig({
  resolve: {
    alias: {
      '@spieleblock/shared': src('./packages/shared/src/index.ts'),
      '@spieleblock/games': src('./packages/games/src/index.ts'),
    },
  },
  test: {
    include: ['packages/{shared,games,server}/src/**/*.test.ts'],
    environment: 'node',
  },
});
