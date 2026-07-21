import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    ignorePatterns: ['apps/web/static/iroh/**', 'crates/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    ignorePatterns: ['apps/web/static/iroh/**', 'crates/**'],
    printWidth: 100,
    singleQuote: true,
  },
  test: {
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
  },
});
