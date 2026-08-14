import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: '/ln-invoice-decoder/',
  plugins: [viteSingleFile()],
  build: { target: 'es2022', cssCodeSplit: false, assetsInlineLimit: 100_000_000 },
})
