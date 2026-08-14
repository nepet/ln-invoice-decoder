import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let html = ''
const tempDirs: string[] = []

beforeAll(() => {
  execFileSync('npm', ['run', 'build'], { stdio: 'inherit' })
  html = readFileSync('dist/index.html', 'utf8')
}, 180_000)

afterEach(() => {
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true })
})

// Runs the real verifier script against `dir` (defaults to the real `dist`
// when called with no fixture). Throws on a non-zero exit, exactly like the
// build step would fail.
const verify = (dir: string) => execFileSync('node', ['scripts/verify-artifact.mjs', dir], { stdio: 'pipe' })

// Writes a mutated copy of the real built HTML (plus any extra files) into a
// fresh temp directory, so we can point the verifier at a "bad" artifact
// without touching the real, good one in `dist`.
const fixture = (mutate: (source: string) => string, extraFiles: Record<string, string> = {}): string => {
  const dir = mkdtempSync(join(tmpdir(), 'artifact-fixture-'))
  tempDirs.push(dir)
  writeFileSync(join(dir, 'index.html'), mutate(html))
  for (const [name, content] of Object.entries(extraFiles)) writeFileSync(join(dir, name), content)
  return dir
}

describe('built artifact', () => {
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

// The tests above only ever run the verifier against a known-good build, so
// they can't tell a working guard from a deleted one. These tests mutate a
// copy of the real artifact into something that should be rejected, and
// confirm scripts/verify-artifact.mjs actually rejects it (non-zero exit).
describe('verify-artifact.mjs', () => {
  it('passes on the real build, named explicitly', () => {
    expect(() => verify('dist')).not.toThrow()
  })

  it('fails when the directory has a file besides index.html', () => {
    const dir = fixture(source => source, { 'extra.txt': 'nope' })
    expect(() => verify(dir)).toThrow()
  })

  it('fails when the CSP meta tag is removed', () => {
    const dir = fixture(source => source.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''))
    expect(() => verify(dir)).toThrow()
  })

  it('fails when the CSP allows unsafe-inline', () => {
    const dir = fixture(source => source.replace('<head>', '<head><!-- unsafe-inline -->'))
    expect(() => verify(dir)).toThrow()
  })

  it('fails on a single-quoted external script src', () => {
    const dir = fixture(source => source.replace('</body>', `<script src='https://evil.test/x.js'></script></body>`))
    expect(() => verify(dir)).toThrow()
  })

  it('fails on a protocol-relative link href', () => {
    const dir = fixture(source => source.replace('</head>', `<link href="//evil.test/x.css"></head>`))
    expect(() => verify(dir)).toThrow()
  })

  it('fails on an external url() inside inlined CSS', () => {
    const dir = fixture(source => source.replace('</head>', `<style>.x{background:url(https://evil.test/a.png)}</style></head>`))
    expect(() => verify(dir)).toThrow()
  })
})
