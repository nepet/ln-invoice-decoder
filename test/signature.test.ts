import { describe, it, expect } from 'vitest'
import { decodeBech32Tolerant } from '../src/decode/bech32'
import { splitDataPart } from '../src/decode/fields'
import { recoverPayee } from '../src/decode/signature'
import { SPEC_COFFEE, SPEC_ROUTE_HINT } from './fixtures/invoices'

/** Every spec vector is signed by the same well-known test key. */
const SPEC_PAYEE = '03e7156ae33b0a208d0744199163177e909e80176e55d97a2f221ede0f934dd9ad'

const recover = (invoice: string) => {
  const { value: b } = decodeBech32Tolerant(invoice)
  const { value: parts } = splitDataPart(b!.words, b!.dataStart)
  const dataWords = b!.words.slice(0, b!.words.length - parts.signatureWords.length)
  return recoverPayee(b!.hrp, dataWords, parts.signatureWords)
}

describe('recoverPayee', () => {
  it('recovers the payee from an invoice with no n field', () => {
    const { value } = recover(SPEC_COFFEE)
    expect(value.payeeNodeId).toBe(SPEC_PAYEE)
    expect(value.signatureValid).toBe(true)
  })

  it('recovers the same payee from the route-hint vector', () => {
    expect(recover(SPEC_ROUTE_HINT).value.payeeNodeId).toBe(SPEC_PAYEE)
  })

  it('reports an unrecoverable signature without throwing', () => {
    const { value: b } = decodeBech32Tolerant(SPEC_COFFEE)
    const { value: parts } = splitDataPart(b!.words, b!.dataStart)
    const dataWords = b!.words.slice(0, b!.words.length - parts.signatureWords.length)
    const junk = Uint8Array.from(parts.signatureWords).fill(0)
    const { value, diagnostics } = recoverPayee(b!.hrp, dataWords, junk)
    expect(value.signatureValid).toBe(false)
    expect(value.payeeNodeId).toBeNull()
    expect(diagnostics[0]!.severity).toBe('warning')
  })

  it('reports a wrong-length signature without throwing', () => {
    const { value } = recoverPayee('lnbc', Uint8Array.from([0]), Uint8Array.from([0, 1, 2]))
    expect(value.signatureValid).toBe(false)
  })
})
