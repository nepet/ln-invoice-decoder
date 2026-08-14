import type {
  DecodedInvoice, Diagnostic, HintCost, Hop, Severity, ShortChannelId,
} from '../domain/types'
import { bytesToHex } from '../decode/words'

export function formatAmount(msat: bigint | null): string {
  if (msat === null) return 'any amount'
  const group = (n: bigint) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${group(msat)} msat (${group(msat / 1000n)} sat)`
}

export const formatScid = (s: ShortChannelId) => `${s.block}x${s.tx}x${s.output}`

export function formatDuration(seconds: number): string {
  if (seconds < 0) return `expired ${formatDuration(-seconds)} ago`
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

const el = (tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement => {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  if (text !== undefined) node.textContent = text
  return node
}

/** A monospaced leaf value. Its own text is the copy payload unless `copy` overrides it
 *  — used for Short Channel IDs, where the raw decimal, not the display string, gets copied. */
const value = (tag: string, text: string, copy: string = text): HTMLElement => {
  const node = el(tag, { class: 'value', 'data-copy': copy })
  node.textContent = text
  return node
}

const row = (label: string, valueNode: HTMLElement): HTMLElement => {
  const r = el('div', { class: 'row' })
  r.append(el('span', { class: 'label' }, label), valueNode)
  return r
}

const section = (name: string): HTMLElement => el('section', { 'data-section': name })

const empty = (text: string): HTMLElement => el('p', { class: 'empty' }, text)

export function renderInvoice(inv: DecodedInvoice, now: Date): HTMLElement {
  const root = el('div', { class: 'decoded-invoice' })
  root.append(
    renderVerdict(inv, now),
    renderDiagnostics(inv.diagnostics),
    renderRouteHints(inv),
    renderFields(inv),
    renderRaw(inv),
  )
  return root
}

function renderVerdict(inv: DecodedInvoice, now: Date): HTMLElement {
  const s = section('verdict')

  const sig = el('div', { class: 'signature', 'data-ok': String(inv.signatureValid) })
  sig.textContent = inv.signatureValid ? 'Signature valid' : 'Signature invalid'
  s.append(sig)

  s.append(row('Payee', value('span', inv.payeeNodeId ?? 'unknown')))
  s.append(row('Network', value('span', inv.hrp.network ?? 'unknown')))
  s.append(row('Amount', value('span', formatAmount(inv.hrp.amountMsat))))
  s.append(row('Expiry', value('span', expiryText(inv, now))))

  if (inv.description) s.append(row('Description', value('span', inv.description)))

  s.append(row('Diagnostics', value('span', severityCountsText(inv.diagnostics))))

  return s
}

function expiryText(inv: DecodedInvoice, now: Date): string {
  if (inv.timestamp === null) return 'unknown'
  const nowSeconds = Math.floor(now.getTime() / 1000)
  const remaining = inv.timestamp + inv.expirySeconds - nowSeconds
  return formatDuration(remaining)
}

function severityCountsText(diagnostics: Diagnostic[]): string {
  const counts: Record<Severity, number> = { error: 0, warning: 0, info: 0 }
  for (const d of diagnostics) counts[d.severity]++
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return `${plural(counts.error, 'error')}, ${plural(counts.warning, 'warning')}, ${plural(counts.info, 'info')}`
}

function renderDiagnostics(diagnostics: Diagnostic[]): HTMLElement {
  const s = section('diagnostics')
  s.append(el('h2', {}, 'Diagnostics'))
  if (diagnostics.length === 0) {
    s.append(empty('No diagnostics.'))
    return s
  }

  const list = el('ul', { class: 'diagnostics' })
  for (const d of diagnostics) {
    const li = el('li', { 'data-severity': d.severity, 'data-source': d.source.kind })
    li.append(el('span', { class: 'kind' }, d.source.kind))
    li.append(el('span', { class: 'message' }, d.message))
    if (d.source.kind === 'spec') {
      li.append(el('span', { class: 'citation' }, `(${d.source.rule})`))
    } else if (d.source.kind === 'practice') {
      li.append(el('span', { class: 'citation' }, `(${d.source.implementations.join(', ')})`))
    }
    if (d.field) li.append(el('span', { class: 'anchor' }, `[${d.field}]`))
    list.append(li)
  }
  s.append(list)
  return s
}

function renderRouteHints(inv: DecodedInvoice): HTMLElement {
  const s = section('route-hints')
  s.append(el('h2', {}, 'Route Hints'))
  if (inv.routeHints.length === 0) {
    s.append(empty('No route hints.'))
    return s
  }

  inv.routeHints.forEach((hint, hintIndex) => {
    const div = el('div', { 'data-hint': String(hintIndex), class: 'hint' })
    div.append(el('h3', {}, `Route Hint ${hintIndex + 1}`))
    hint.hops.forEach((hop, hopIndex) => div.append(renderHop(hop, hopIndex)))
    if (hint.cost !== null) div.append(renderHintCost(hint.cost, inv.hrp.amountMsat))
    s.append(div)
  })
  return s
}

function renderHop(hop: Hop, hopIndex: number): HTMLElement {
  const div = el('div', { 'data-hop': String(hopIndex), class: 'hop' })
  div.append(el('h4', {}, `Hop ${hopIndex + 1}`))
  div.append(row('Node', value('code', hop.nodeId)))
  div.append(row('Short Channel ID', value('code', formatScid(hop.scid), hop.scid.raw)))
  div.append(row('Base Fee', value('span', `${hop.feeBaseMsat} msat`)))
  div.append(row('Proportional Fee', value('span', `${hop.feeProportionalMillionths} ppm`)))
  div.append(row('CLTV Delta', value('span', String(hop.cltvExpiryDelta))))
  return div
}

function renderHintCost(cost: HintCost, amountMsat: bigint | null): HTMLElement {
  const div = el('div', { 'data-hint-cost': '', class: 'hint-cost' })
  div.append(el('h4', {}, 'Hint Cost'))
  div.append(row('Fee', value('span', `${cost.feeMsat} msat`)))
  if (amountMsat !== null && amountMsat > 0n) {
    const pct = (Number(cost.feeMsat) / Number(amountMsat)) * 100
    div.append(row('% of Amount', value('span', `${pct.toFixed(3)}%`)))
  }
  div.append(row('CLTV Delta', value('span', String(cost.cltvDelta))))
  return div
}

function renderFields(inv: DecodedInvoice): HTMLElement {
  const s = section('fields')
  s.append(el('h2', {}, 'Tagged Fields'))
  if (inv.fields.length === 0) {
    s.append(empty('No tagged fields.'))
    return s
  }

  for (const field of inv.fields) {
    const div = el('div', { 'data-field': field.tag, class: 'field' })
    div.append(row('Tag', value('code', field.tag)))
    div.append(row('Name', value('span', field.name)))
    div.append(row('Value', value('span', field.display)))

    const details = el('details')
    details.append(el('summary', {}, 'raw'))
    const pre = el('pre', { 'data-raw': '' })
    const rawChars = inv.input.slice(field.raw.span.start, field.raw.span.end)
    pre.textContent = `${rawChars}\n${bytesToHex(field.raw.words)}`
    details.append(pre)
    div.append(details)

    s.append(div)
  }
  return s
}

function renderRaw(inv: DecodedInvoice): HTMLElement {
  const s = section('raw')
  s.append(el('h2', {}, 'Raw'))

  const raw = inv.input
  const hrpLen = inv.hrp.raw.length
  const split = hrpLen > 0 && raw.toLowerCase().startsWith(inv.hrp.raw.toLowerCase())
  const hrpText = split ? raw.slice(0, hrpLen) : ''
  const dataText = split ? raw.slice(hrpLen) : raw

  s.append(row('Human-Readable Part', value('code', hrpText || '(unknown)')))
  s.append(row('Data Part', value('code', dataText || '(none)')))
  return s
}
