import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: '/ln-invoice-decoder/',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    // The artifact's pitch is that you can read it. Minified identifiers are
    // not readable, and the modulepreload polyfill puts a literal `fetch(` in
    // a file whose README promises no network primitives — and it is dead
    // weight anyway, because a single-file build emits no preload links.
    minify: false,
    modulePreload: { polyfill: false },
  },
})
