import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const file = 'dist/index.html'
let html = readFileSync(file, 'utf8')

const hash = source => `'sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}'`
const contents = (tag) => [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))]
  .map(m => m[1])
  .filter(s => s.length > 0)

const csp = [
  "default-src 'none'",
  `script-src ${contents('script').map(hash).join(' ')}`,
  `style-src ${contents('style').map(hash).join(' ')}`,
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

html = html.replace(/<head>/, `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`)
writeFileSync(file, html)
console.log('CSP injected')
