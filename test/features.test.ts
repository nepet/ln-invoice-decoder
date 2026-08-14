import { describe, it, expect } from 'vitest'
import { decodeFeatures } from '../src/decode/features'
import type { RawField } from '../src/domain/types'

const field = (words: number[]): RawField => ({
  tag: '9', type: 5, dataLength: words.length,
  words: Uint8Array.from(words), span: { start: 0, end: 0 },
})

describe('decodeFeatures', () => {
  it('reads bit 0 as the last bit of the last word', () => {
    expect(decodeFeatures(field([1])).value.map(f => f.bit)).toEqual([0])
    expect(decodeFeatures(field([1, 0])).value.map(f => f.bit)).toEqual([5])
  })

  // Bit N lives in word (length - 1 - floor(N / 5)), at bit (N % 5).
  it('names known bits and marks required ones', () => {
    // bit 8 = var_onion_optin (required), bit 15 = payment_secret (optional)
    const features = decodeFeatures(field([0b00001, 0b00000, 0b01000, 0b00000])).value
    expect(features.find(f => f.bit === 15)).toEqual({ bit: 15, name: 'payment_secret', required: false })
    expect(features.find(f => f.bit === 8)).toEqual({ bit: 8, name: 'var_onion_optin', required: true })
  })

  it('warns about an unknown even bit', () => {
    // bit 36: word 7 from the end, bit 1. Even, and not in the BOLT9 table.
    const { value, diagnostics } = decodeFeatures(field([0b00010, 0, 0, 0, 0, 0, 0, 0]))
    expect(value.some(f => f.bit === 36 && f.name === null)).toBe(true)
    expect(diagnostics.some(d => d.severity === 'warning' && /MUST refuse/.test(d.message))).toBe(true)
  })

  it('says nothing about an unknown odd bit', () => {
    // bit 3: unknown, and odd, so a payer may ignore it.
    const { value, diagnostics } = decodeFeatures(field([0b01000]))
    expect(value).toEqual([{ bit: 3, name: null, required: false }])
    expect(diagnostics).toEqual([])
  })
})
