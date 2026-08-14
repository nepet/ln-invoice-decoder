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

  it('resolves a duplicate field to the first occurrence, not the last', () => {
    // Splice a second `x` (expiry) field in right after the existing one,
    // carrying a different value, so first-wins is actually exercised.
    // A tagged field is [type, lenHi, lenLo, ...dataWords]; `x`'s type value
    // is 6 (its index in the bech32 charset 'qpzry9x8gf2tvdw0s3jn54khce6mua7l').
    // Two data words hold up to 1023, encoded big-endian base-32, so
    // 120 seconds = 3*32 + 24 -> words [3, 24]. With lenHi=0, lenLo=2 the
    // header reads dataLength=2, matching those two words: [6, 0, 2, 3, 24].
    const { value: b } = decodeBech32Tolerant(SPEC_COFFEE)
    const x = splitDataPart(b!.words, b!.dataStart).value.fields.find(f => f.tag === 'x')!
    const at = x.span.start - b!.dataStart
    const secondExpiry = [6, 0, 2, 3, 24]
    const doubled = mangleWords(SPEC_COFFEE, w => {
      w.splice(at + 3 + x.dataLength, 0, ...secondExpiry)
      return w
    })
    const inv = decodeInvoice(doubled, AT_CREATION)
    expect(inv.expirySeconds).toBe(60) // the first field's value, not the spliced-in 120
    expect(inv.diagnostics.some(d => d.severity === 'warning' && /Two 'x' fields/.test(d.message))).toBe(true)
    const xFields = inv.fields.filter(f => f.tag === 'x')
    expect(xFields.length).toBe(2)
    expect(xFields[0]!.display).not.toBe(xFields[1]!.display)
  })

  it('says only that a truncated invoice is truncated', () => {
    // Cut in half. The real answer is "it is cut in half", so the practice
    // rules and the field-absence infos — every one of which is about a field
    // a complete invoice would have carried — must stay quiet.
    // Cut just past the fields (a field runs into the signature) and cut so
    // short there is no room for a signature at all — both stop the walk.
    for (const cut of [Math.floor(SPEC_COFFEE.length / 2), 40]) {
      const inv = decodeInvoice(SPEC_COFFEE.slice(0, cut), AT_CREATION)
      expect(inv.fields).toEqual([])
      expect(inv.diagnostics.some(d => d.severity === 'error')).toBe(true)
      expect(inv.diagnostics.filter(d => d.source.kind === 'practice')).toEqual([])
      expect(inv.diagnostics.some(d => /payment secret/i.test(d.message))).toBe(false)
      expect(inv.diagnostics.some(d => /neither a description/.test(d.message))).toBe(false)
      expect(inv.diagnostics.some(d => /No expiry set/.test(d.message))).toBe(false)
      expect(inv.diagnostics.some(d => /No minimum final CLTV/.test(d.message))).toBe(false)
    }
  })

  it('explains that the payee is recovered, not verified, when there is no n field', () => {
    const inv = decodeInvoice(SPEC_COFFEE, AT_CREATION)
    expect(inv.fields.some(f => f.tag === 'n')).toBe(false)
    const d = inv.diagnostics.find(x => /recovered from the signature/.test(x.message))!
    expect(d.severity).toBe('info')
    expect(d.message).toMatch(/different payee/)
  })

  it('accepts a zero-length description as a description', () => {
    // A legal, if useless, empty `d` field: replace the existing one's payload
    // with a zero-length one ('d' is word 13 of the bech32 charset).
    const { value: b } = decodeBech32Tolerant(SPEC_COFFEE)
    const d = splitDataPart(b!.words, b!.dataStart).value.fields.find(f => f.tag === 'd')!
    const at = d.span.start - b!.dataStart
    const emptyDescription = mangleWords(SPEC_COFFEE, w => {
      w.splice(at, 3 + d.dataLength, 13, 0, 0)
      return w
    })
    const inv = decodeInvoice(emptyDescription, AT_CREATION)
    expect(inv.description).toBe('')
    expect(inv.diagnostics.some(x => /neither a description/.test(x.message))).toBe(false)
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
