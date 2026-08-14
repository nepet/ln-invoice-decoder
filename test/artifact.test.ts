import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'

let html = ''

describe('built artifact', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
    html = readFileSync('dist/index.html', 'utf8')
  }, 180_000)

  it('is a single file', () => {
    expect(readdirSync('dist').filter(f => f !== 'index.html' && !f.startsWith('.'))).toEqual([])
  })

  it('forbids network access in its CSP', () => {
    expect(html).toMatch(/http-equiv="Content-Security-Policy"/)
    expect(html).toMatch(/connect-src 'none'/)
    expect(html).toMatch(/default-src 'none'/)
  })

  it('hashes every inline script and style rather than allowing unsafe-inline', () => {
    expect(html).toMatch(/script-src 'sha256-[A-Za-z0-9+/=]+'/)
    expect(html).not.toMatch(/unsafe-inline/)
  })

  it('references nothing external', () => {
    expect(html).not.toMatch(/(src|href)="https?:/)
  })
})
