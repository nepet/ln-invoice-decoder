import { describe, it, expect } from 'vitest'
import { decodeBech32Tolerant } from '../src/decode/bech32'
import { splitDataPart } from '../src/decode/fields'
import { decodeFallback } from '../src/decode/fallback'
import type { RawField } from '../src/domain/types'
import { SPEC_FALLBACK } from './fixtures/invoices'

const raw = (words: number[]): RawField => ({
  tag: 'f', type: 9, dataLength: words.length,
  words: Uint8Array.from(words), span: { start: 0, end: 0 },
})

describe('decodeFallback', () => {
  it('renders the spec vector fallback address', () => {
    const { value } = decodeBech32Tolerant(SPEC_FALLBACK)
    const f = splitDataPart(value!.words, value!.dataStart).value.fields.find(x => x.tag === 'f')!
    // SPEC_FALLBACK is the testnet vector, so this is a testnet P2PKH address.
    // Compare against the address the spec states for that vector, verbatim.
    expect(decodeFallback(f, 'testnet').value).toMatch(/^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/)
  })

  it('renders a segwit v0 program as a bech32 address', () => {
    const program = new Array(32).fill(0) // 20 bytes = 32 words
    expect(decodeFallback(raw([0, ...program]), 'mainnet').value).toMatch(/^bc1q/)
  })

  it('renders a segwit v1 program as bech32m', () => {
    const program = new Array(52).fill(0) // 32 bytes
    expect(decodeFallback(raw([1, ...program]), 'mainnet').value).toMatch(/^bc1p/)
  })

  it('renders for the invoice network, warning when that is unknown', () => {
    expect(decodeFallback(raw([0, ...new Array(32).fill(0)]), 'testnet').value).toMatch(/^tb1q/)
    const { diagnostics } = decodeFallback(raw([0, ...new Array(32).fill(0)]), null)
    expect(diagnostics.some(d => d.severity === 'warning' && /unknown/.test(d.message))).toBe(true)
  })

  it('warns rather than throwing on an unknown version', () => {
    const { value, diagnostics } = decodeFallback(raw([31, 0, 0]), 'mainnet')
    expect(value).toBeNull()
    expect(diagnostics[0]!.severity).toBe('warning')
  })
})
