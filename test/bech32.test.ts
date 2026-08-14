import { describe, it, expect } from 'vitest'
import { decodeBech32Tolerant, encodeBech32 } from '../src/decode/bech32'
import { SPEC_COFFEE } from './fixtures/invoices'

describe('decodeBech32Tolerant', () => {
  it('splits a real invoice into hrp and data words', () => {
    const { value } = decodeBech32Tolerant(SPEC_COFFEE)
    expect(value!.hrp).toBe('lnbc2500u')
    expect(value!.checksumValid).toBe(true)
    expect(value!.dataStart).toBe(SPEC_COFFEE.indexOf('1', 4) + 1)
    expect(value!.words.length).toBe(SPEC_COFFEE.length - value!.dataStart - 6)
  })

  it('ignores the 90-character bech32 limit', () => {
    expect(SPEC_COFFEE.length).toBeGreaterThan(90)
    expect(decodeBech32Tolerant(SPEC_COFFEE).value).not.toBeNull()
  })

  it('warns but still decodes when the checksum is wrong', () => {
    const broken = SPEC_COFFEE.slice(0, -1) + (SPEC_COFFEE.endsWith('q') ? 'p' : 'q')
    const { value, diagnostics } = decodeBech32Tolerant(broken)
    expect(value!.checksumValid).toBe(false)
    expect(value!.words.length).toBeGreaterThan(0)
    expect(diagnostics.some(d => d.severity === 'warning' && /checksum/i.test(d.message))).toBe(true)
  })

  it('errors on an invalid character, naming its position', () => {
    const { value, diagnostics } = decodeBech32Tolerant('lnbc1bbbbbb')
    expect(value).toBeNull()
    expect(diagnostics[0]!.severity).toBe('error')
    expect(diagnostics[0]!.message).toMatch(/position/)
  })

  it('errors when there is no separator', () => {
    expect(decodeBech32Tolerant('lnbc').value).toBeNull()
  })

  it('round-trips: encode(decode(x)) === x', () => {
    const { value } = decodeBech32Tolerant(SPEC_COFFEE)
    expect(encodeBech32(value!.hrp, value!.words)).toBe(SPEC_COFFEE)
  })

  it('accepts uppercase input, as QR codes produce', () => {
    const { value } = decodeBech32Tolerant(SPEC_COFFEE.toUpperCase())
    expect(value!.hrp).toBe('lnbc2500u')
  })
})
