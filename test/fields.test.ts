import { describe, it, expect } from 'vitest'
import { decodeBech32Tolerant } from '../src/decode/bech32'
import { splitDataPart, TAG_NAMES } from '../src/decode/fields'
import { SPEC_COFFEE } from './fixtures/invoices'
import { mangleWords } from './fixtures/mangle'

const split = (invoice: string) => {
  const { value } = decodeBech32Tolerant(invoice)
  return splitDataPart(value!.words, value!.dataStart)
}

describe('splitDataPart', () => {
  it('reads the timestamp, the fields, and a 104-word signature', () => {
    const { value } = split(SPEC_COFFEE)
    expect(value.timestamp).toBe(1496314658)
    expect(value.signatureWords.length).toBe(104)
    expect(value.fields.map(f => f.tag)).toContain('p')
    expect(value.fields.map(f => f.tag)).toContain('d')
  })

  it('records each field span in characters of the original invoice', () => {
    const { value } = split(SPEC_COFFEE)
    const p = value.fields.find(f => f.tag === 'p')!
    expect(SPEC_COFFEE.slice(p.span.start, p.span.end).length).toBe(p.dataLength + 3)
    expect(SPEC_COFFEE[p.span.start]).toBe('p')
  })

  it('names known tags and leaves unknown ones unnamed', () => {
    expect(TAG_NAMES['p']).toBe('payment_hash')
    expect(TAG_NAMES['r']).toBe('route_hint')
    expect(TAG_NAMES['k']).toBeUndefined()
  })

  it('errors when a field declares more words than remain', () => {
    // Blow up the declared length of the first tagged field (words 7,8,9).
    const broken = mangleWords(SPEC_COFFEE, w => { w[8] = 31; w[9] = 31; return w })
    const { value, diagnostics } = split(broken)
    expect(diagnostics.some(d => d.severity === 'error' && /declares/.test(d.message))).toBe(true)
    expect(value.timestamp).toBe(1496314658) // still reports what it read
  })

  it('errors when the data part is too short to hold a signature', () => {
    const { diagnostics } = splitDataPart(Uint8Array.from([1, 2, 3]), 9)
    expect(diagnostics[0]!.severity).toBe('error')
    expect(diagnostics[0]!.message).toMatch(/truncated/i)
  })
})
