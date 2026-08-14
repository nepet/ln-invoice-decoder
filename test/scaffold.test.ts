import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

describe('scaffold', () => {
  it('pins the GitHub Pages base path', () => {
    const config = readFileSync('vite.config.ts', 'utf8')
    expect(config).toContain("base: '/ln-invoice-decoder/'")
  })

  it('declares only the four runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      '@noble/curves',
      '@noble/hashes',
      'jsqr',
    ])
  })
})
