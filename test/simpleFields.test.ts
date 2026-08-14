import { describe, it, expect } from 'vitest'
import { decodeBech32Tolerant } from '../src/decode/bech32'
import { splitDataPart } from '../src/decode/fields'
import { checkLength, decodeDescription, decodeHexField, decodeIntField } from '../src/decode/simpleFields'
import { SPEC_COFFEE } from './fixtures/invoices'
import { mangleWords } from './fixtures/mangle'

const fieldsOf = (invoice: string) => {
  const { value } = decodeBech32Tolerant(invoice)
  return splitDataPart(value!.words, value!.dataStart).value.fields
}

describe('simple field decoders', () => {
  it('decodes a payment hash to 64 hex characters', () => {
    const p = fieldsOf(SPEC_COFFEE).find(f => f.tag === 'p')!
    const { value } = decodeHexField(p)
    expect(value).toMatch(/^[0-9a-f]{64}$/)
  })

  it('decodes a description as UTF-8', () => {
    const d = fieldsOf(SPEC_COFFEE).find(f => f.tag === 'd')!
    expect(decodeDescription(d).value).toBe('1 cup coffee')
  })

  it('decodes expiry as an integer', () => {
    const x = fieldsOf(SPEC_COFFEE).find(f => f.tag === 'x')!
    expect(decodeIntField(x)).toBe(60)
  })

  it('warns that a wrong-length p field will be silently skipped', () => {
    // Drop one word from the payment hash and re-checksum.
    // Locate the p field through the decoder rather than guessing its index —
    // field order varies between spec vectors, and scanning the words for the
    // value 1 would match a data word and mutate the wrong thing silently.
    const { value: b } = decodeBech32Tolerant(SPEC_COFFEE)
    const p0 = splitDataPart(b!.words, b!.dataStart).value.fields.find(f => f.tag === 'p')!
    const at = p0.span.start - b!.dataStart   // index of p's type word
    const broken = mangleWords(SPEC_COFFEE, w => {
      w[at + 2] = w[at + 2]! - 1   // declared length: 52 → 51
      w.splice(at + 3, 1)          // drop one data word to match
      return w
    })
    const p = fieldsOf(broken).find(f => f.tag === 'p')!
    const d = checkLength(p)!
    expect(d.severity).toBe('warning')
    expect(d.message).toMatch(/51 words, expected 52/)
    expect(d.message).toMatch(/skip/)
    expect(d.field).toBe('p')
  })

  it('has nothing to say about a correct length or an unknown tag', () => {
    const p = fieldsOf(SPEC_COFFEE).find(f => f.tag === 'p')!
    expect(checkLength(p)).toBeNull()
    expect(checkLength({ ...p, tag: 'k' })).toBeNull()
  })
})
