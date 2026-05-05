import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  minify: false,
  clean: true,
  outDirTypes: 'dist/types',
  rollupOptions: {
    external: ['winston', 'node'],
  },
  shims: true,
})
