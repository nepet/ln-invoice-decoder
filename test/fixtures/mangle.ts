import { decodeBech32Tolerant, encodeBech32 } from '../../src/decode/bech32'

/**
 * Re-encode an invoice after mutating its data words, fixing the checksum.
 * The signature will not verify afterwards — that is expected and documented.
 */
export function mangleWords(invoice: string, mutate: (words: number[]) => number[]): string {
  const { value } = decodeBech32Tolerant(invoice)
  if (!value) throw new Error('fixture is not decodable')
  return encodeBech32(value.hrp, Uint8Array.from(mutate([...value.words])))
}

/** Re-encode with a different human-readable part, keeping the data words. */
export function mangleHrp(invoice: string, hrp: string): string {
  const { value } = decodeBech32Tolerant(invoice)
  if (!value) throw new Error('fixture is not decodable')
  return encodeBech32(hrp, value.words)
}
