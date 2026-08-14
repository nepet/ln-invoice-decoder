import { describe, it, expect } from 'vitest'
import { decodeInvoice } from '../src/decode/invoice'
import { decodeBech32Tolerant } from '../src/decode/bech32'
import { splitDataPart } from '../src/decode/fields'
import { SPEC_COFFEE, SPEC_DONATION, SPEC_ROUTE_HINT } from './fixtures/invoices'
import { mangleWords } from './fixtures/mangle'

const AT_CREATION = new Date(1496314658 * 1000 + 30_000)

describe('decodeInvoice', () => {
  it('assembles the whole view model for a real invoice', () => {
    const inv = decodeInvoice(SPEC_COFFEE, AT_CREATION)
    expect(inv.hrp.network).toBe('mainnet')
    expect(inv.hrp.amountMsat).toBe(250_000_000n)
    expect(inv.description).toBe('1 cup coffee')
    expect(inv.paymentHash).toMatch(/^[0-9a-f]{64}$/)
    expect(inv.signatureValid).toBe(true)
    expect(inv.expirySeconds).toBe(60)
    expect(inv.minFinalCltvExpiryDelta).toBe(18)  // default when c is absent
  })

  it('populates route hints with their cost', () => {
    const inv = decodeInvoice(SPEC_ROUTE_HINT, AT_CREATION)
    expect(inv.routeHints.length).toBeGreaterThan(0)
    expect(inv.routeHints[0]!.hops.length).toBe(2)
    expect(inv.routeHints[0]!.cost!.feeMsat).toBeGreaterThan(0n)
  })

  it('hides hint cost on a zero-amount invoice and says why', () => {
    const inv = decodeInvoice(SPEC_DONATION, AT_CREATION)
    expect(inv.hrp.amountMsat).toBeNull()
    for (const hint of inv.routeHints) expect(hint.cost).toBeNull()
    expect(inv.diagnostics.some(d => d.severity === 'info' && /payer chooses/.test(d.message))).toBe(true)
  })

  it('reports an expired invoice as info', () => {
    const inv = decodeInvoice(SPEC_COFFEE, new Date(1496314658 * 1000 + 3_600_000))
    expect(inv.diagnostics.some(d => d.severity === 'info' && /Expired/.test(d.message))).toBe(true)
  })

  it('warns when there is no payment secret', () => {
    // Current spec vectors all carry an `s` field, so build one without it:
    // splice the whole field out of the word stream and re-checksum.
    const { value: b } = decodeBech32Tolerant(SPEC_COFFEE)
    const s = splitDataPart(b!.words, b!.dataStart).value.fields.find(f => f.tag === 's')!
    const at = s.span.start - b!.dataStart
    const noSecret = mangleWords(SPEC_COFFEE, w => {
      w.splice(at, 3 + s.dataLength)
      return w
    })
    const inv = decodeInvoice(noSecret, AT_CREATION)
    expect(inv.paymentSecret).toBeNull()
    const d = inv.diagnostics.find(x => /payment secret/i.test(x.message))!
    expect(d.source).toEqual({ kind: 'practice', implementations: ['LND', 'CLN'] })
  })

  it('never throws, whatever it is given', () => {
    for (const junk of ['', 'x', 'lnbc', 'lnbc1', 'ln', '1', 'lnbc1'.repeat(50), '💥']) {
      expect(() => decodeInvoice(junk, AT_CREATION)).not.toThrow()
    }
  })

  it('sorts diagnostics most severe first', () => {
    const inv = decodeInvoice(SPEC_COFFEE, AT_CREATION)
    const rank = { error: 0, warning: 1, info: 2 }
    const ranks = inv.diagnostics.map(d => rank[d.severity])
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })
})
