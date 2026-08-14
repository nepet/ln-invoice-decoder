import { describe, it, expect } from 'vitest'
import { decodeBech32Tolerant } from '../src/decode/bech32'
import { splitDataPart } from '../src/decode/fields'
import { decodeRouteHint, hintCost, validateHint } from '../src/decode/routeHints'
import type { Hop } from '../src/domain/types'
import { SPEC_ROUTE_HINT } from './fixtures/invoices'

const hop = (over: Partial<Hop> = {}): Hop => ({
  nodeId: '03'.padEnd(66, 'a'),
  // (1<<40)|(2<<16)|3 = 1099511758851
  scid: { block: 1, tx: 2, output: 3, raw: '1099511758851' },
  feeBaseMsat: 0,
  feeProportionalMillionths: 0,
  cltvExpiryDelta: 40,
  ...over,
})

// BOLT11 spec's route-hint example (SPEC_ROUTE_HINT), first hop's short_channel_id,
// stated in the spec prose as 66051x263430x1800 (block x tx x output).
// Packed by hand: (66051<<40)|(263430<<16)|1800 = 72623859790382856.
const EXPECTED_FIRST_SCID = { raw: '72623859790382856', block: 66051, tx: 263430, output: 1800 }

describe('decodeRouteHint', () => {
  it('decodes both hops of the spec vector', () => {
    const { value } = decodeBech32Tolerant(SPEC_ROUTE_HINT)
    const field = splitDataPart(value!.words, value!.dataStart).value.fields.find(f => f.tag === 'r')!
    const { value: hops } = decodeRouteHint(field, 0)
    expect(hops.length).toBe(2)
    expect(hops[0]!.nodeId).toMatch(/^0[23][0-9a-f]{64}$/)
    expect(hops[0]!.cltvExpiryDelta).toBeGreaterThan(0)
    expect(hops[0]!.scid.raw).toMatch(/^\d+$/)
  })

  it('splits the short channel id into block, tx and output', () => {
    const { value } = decodeBech32Tolerant(SPEC_ROUTE_HINT)
    const field = splitDataPart(value!.words, value!.dataStart).value.fields.find(f => f.tag === 'r')!
    const [first] = decodeRouteHint(field, 0).value
    expect(first!.scid.raw).toBe(EXPECTED_FIRST_SCID.raw)
    expect(first!.scid.block).toBe(EXPECTED_FIRST_SCID.block)
    expect(first!.scid.tx).toBe(EXPECTED_FIRST_SCID.tx)
    expect(first!.scid.output).toBe(EXPECTED_FIRST_SCID.output)
    expect(BigInt(first!.scid.raw)).toBe(
      (BigInt(first!.scid.block) << 40n) | (BigInt(first!.scid.tx) << 16n) | BigInt(first!.scid.output),
    )
  })

  it('warns when the data is not a whole number of hops', () => {
    const { value } = decodeBech32Tolerant(SPEC_ROUTE_HINT)
    const field = splitDataPart(value!.words, value!.dataStart).value.fields.find(f => f.tag === 'r')!
    const truncated = { ...field, words: field.words.slice(0, field.words.length - 5), dataLength: field.dataLength - 5 }
    const { diagnostics } = decodeRouteHint(truncated, 0)
    expect(diagnostics.some(d => d.severity === 'warning' && /whole number of hops/.test(d.message))).toBe(true)
  })
})

describe('hintCost', () => {
  it('computes fees backwards from the payee', () => {
    const hops = [
      hop({ feeBaseMsat: 1000, feeProportionalMillionths: 1000, cltvExpiryDelta: 144 }), // 0.1%
      hop({ feeBaseMsat: 0, feeProportionalMillionths: 2000, cltvExpiryDelta: 40 }),     // 0.2%
    ]
    // Last hop forwards 1_000_000 msat → fee 2000. First hop forwards 1_002_000 → 1000 + 1002 = 2002.
    expect(hintCost(hops, 1_000_000n)).toEqual({ feeMsat: 4002n, cltvDelta: 184 })
  })

  it('is null when the invoice carries no amount', () => {
    expect(hintCost([hop()], null)).toBeNull()
  })

  it('floors the proportional fee', () => {
    expect(hintCost([hop({ feeProportionalMillionths: 1 })], 999n)!.feeMsat).toBe(0n)
  })
})

describe('validateHint', () => {
  const payee = '02'.padEnd(66, 'b')

  it('flags a zero short channel id', () => {
    const hops = [hop({ scid: { block: 0, tx: 0, output: 0, raw: '0' } })]
    const ds = validateHint(hops, 0, payee, 1000n)
    expect(ds.some(d => /0x0x0/.test(d.message) && d.hopIndex === 0)).toBe(true)
  })

  it('flags a hop that points at the payee, which is implicit', () => {
    const ds = validateHint([hop({ nodeId: payee })], 0, payee, 1000n)
    expect(ds.some(d => /implicit/.test(d.message))).toBe(true)
  })

  it('does not flag a normal single-hop LSP hint', () => {
    const ds = validateHint([hop()], 0, payee, 1000n)
    expect(ds.filter(d => d.severity === 'warning')).toEqual([])
  })

  it('flags a repeated public key within one hint, naming both hops', () => {
    const ds = validateHint([hop(), hop()], 0, payee, 1000n)
    expect(ds.some(d => /Hop 2 repeats the public key .* of hop 1\./.test(d.message) && d.hopIndex === 1)).toBe(true)
  })

  it('flags a zero cltv delta as a practice warning', () => {
    const ds = validateHint([hop({ cltvExpiryDelta: 0 })], 0, payee, 1000n)
    const d = ds.find(x => /CLTV delta of 0/.test(x.message))!
    expect(d.source).toEqual({ kind: 'practice', implementations: ['LND', 'CLN', 'LDK'] })
  })

  it('flags a hint costing more than 5% of the amount', () => {
    const ds = validateHint([hop({ feeProportionalMillionths: 60_000 })], 0, payee, 1_000_000n)
    expect(ds.some(d => /fee limits/.test(d.message))).toBe(true)
  })

  it('notes an unusually long hint', () => {
    const ds = validateHint([hop(), hop({ nodeId: '03'.padEnd(66, 'c') }), hop({ nodeId: '03'.padEnd(66, 'd') }),
                             hop({ nodeId: '03'.padEnd(66, 'e') })], 0, payee, 1000n)
    expect(ds.some(d => d.severity === 'info' && /4 hops/.test(d.message))).toBe(true)
  })
})
