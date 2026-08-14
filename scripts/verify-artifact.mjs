import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'dist'
const file = join(dir, 'index.html')
const html = readFileSync(file, 'utf8')
const problems = []

const extra = readdirSync(dir).filter(f => f !== 'index.html' && !f.startsWith('.'))
if (extra.length) problems.push(`${dir} contains files other than index.html: ${extra.join(', ')}`)
if (!/default-src 'none'/.test(html)) problems.push("CSP is missing default-src 'none'")
if (!/connect-src 'none'/.test(html)) problems.push('CSP is missing connect-src none')
if (/unsafe-inline/.test(html)) problems.push('CSP allows unsafe-inline')

const external = [
  [/(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i, 'an external src or href'],
  [/url\(\s*["']?(?:https?:)?\/\//i, 'an external CSS url()'],
  [/@import/i, 'a CSS @import'],
  // Nothing in the artifact should be able to open a connection at all, so the
  // primitives that could must not appear — including in dependency code the
  // build pulled in. The CSP already forbids the traffic; this makes the claim
  // greppable, which is the first thing a sceptical reader tries.
  [/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts/, 'a network primitive'],
]
for (const [pattern, description] of external) {
  if (pattern.test(html)) problems.push(`artifact references ${description}`)
}

if (problems.length) {
  console.error('Artifact verification failed:\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log(`Artifact verified: ${file} is a single file, no network`)
