// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { decodeInvoice } from '../src/decode/invoice'
import { formatAmount, formatDuration, formatScid, renderInvoice } from '../src/ui/render'
import { SPEC_ROUTE_HINT } from './fixtures/invoices'
import { mangleHrp } from './fixtures/mangle'

const AT_CREATION = new Date(1496314658 * 1000 + 30_000)

describe('formatters', () => {
  it('formats amounts in msat and sat', () => {
    expect(formatAmount(250_000_000n)).toBe('250,000,000 msat (250,000 sat)')
    expect(formatAmount(null)).toBe('any amount')
  })

  it('formats a short channel id as block x tx x output', () => {
    expect(formatScid({ block: 812345, tx: 1122, output: 0, raw: '0' })).toBe('812345x1122x0')
  })

  it('formats durations, including expiry in the past', () => {
    expect(formatDuration(60)).toBe('1m')
    expect(formatDuration(7500)).toBe('2h 5m')
    expect(formatDuration(-180)).toBe('expired 3m ago')
  })
})

describe('renderInvoice', () => {
  it('renders every section in order', () => {
    const el = renderInvoice(decodeInvoice(SPEC_ROUTE_HINT, AT_CREATION), AT_CREATION)
    const sections = [...el.querySelectorAll('section')].map(s => s.dataset.section)
    expect(sections).toEqual(['verdict', 'diagnostics', 'route-hints', 'fields', 'raw'])
  })

  it('renders one block per route hint, with every hop', () => {
    const inv = decodeInvoice(SPEC_ROUTE_HINT, AT_CREATION)
    const el = renderInvoice(inv, AT_CREATION)
    expect(el.querySelectorAll('[data-hint]').length).toBe(inv.routeHints.length)
    expect(el.querySelectorAll('[data-hop]').length).toBe(inv.routeHints[0]!.hops.length)
  })

  it('omits hint cost entirely when the invoice has no amount', () => {
    // Must have hints AND no amount, or the assertion passes vacuously.
    const zeroAmount = mangleHrp(SPEC_ROUTE_HINT, 'lnbc')
    const inv = decodeInvoice(zeroAmount, AT_CREATION)
    expect(inv.hrp.amountMsat).toBeNull()
    expect(inv.routeHints.length).toBeGreaterThan(0)
    const el = renderInvoice(inv, AT_CREATION)
    expect(el.querySelectorAll('[data-hop]').length).toBeGreaterThan(0)
    expect(el.querySelector('[data-hint-cost]')).toBeNull()
  })

  it('gives every field a raw expander holding its own bech32 characters', () => {
    const inv = decodeInvoice(SPEC_ROUTE_HINT, AT_CREATION)
    const el = renderInvoice(inv, AT_CREATION)
    const p = el.querySelector('[data-field="p"] [data-raw]')!
    const field = inv.fields.find(f => f.tag === 'p')!
    expect(p.textContent).toContain(inv.input.slice(field.raw.span.start, field.raw.span.end))
  })

  it('escapes a description containing markup', () => {
    const inv = decodeInvoice(SPEC_ROUTE_HINT, AT_CREATION)
    inv.description = '<img src=x onerror=alert(1)>'
    const el = renderInvoice(inv, AT_CREATION)
    expect(el.querySelector('img')).toBeNull()
  })

  it('marks practice diagnostics distinctly from spec ones', () => {
    // SPEC_ROUTE_HINT carries both a payment secret and the matching feature
    // bit, so decodeInvoice produces no spec- or practice-sourced diagnostic
    // of its own for this fixture — only the renderer's mapping from
    // Diagnostic.source.kind to data-source is under test here, so push one
    // of each kind directly, the same way the test above mutates
    // inv.description post-decode.
    const inv = decodeInvoice(SPEC_ROUTE_HINT, AT_CREATION)
    inv.diagnostics.push(
      { severity: 'warning', message: 'spec-sourced', source: { kind: 'spec', rule: 'BOLT11 example' } },
      { severity: 'warning', message: 'practice-sourced', source: { kind: 'practice', implementations: ['LND'] } },
    )
    const el = renderInvoice(inv, AT_CREATION)
    expect(el.querySelector('[data-source="practice"]')).not.toBeNull()
    expect(el.querySelector('[data-source="spec"]')).not.toBeNull()
  })
})
