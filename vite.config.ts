import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    printWidth: 100,
    singleQuote: true,
  },
  test: {
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
  },
});
