import { readFileSync, readdirSync } from 'node:fs'

const html = readFileSync('dist/index.html', 'utf8')
const problems = []

const extra = readdirSync('dist').filter(f => f !== 'index.html' && !f.startsWith('.'))
if (extra.length) problems.push(`dist contains files other than index.html: ${extra.join(', ')}`)
if (!/connect-src 'none'/.test(html)) problems.push('CSP is missing connect-src none')
if (/unsafe-inline/.test(html)) problems.push('CSP allows unsafe-inline')
if (/(src|href)="https?:/.test(html)) problems.push('artifact references an external URL')

if (problems.length) {
  console.error('Artifact verification failed:\n  ' + problems.join('\n  '))
  process.exit(1)
}
console.log('Artifact verified: single file, no network')
