import { err, specWarn } from '../domain/diagnostics'
import type { Decoded, Diagnostic } from '../domain/types'

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

export interface Bech32Result {
  hrp: string
  words: Uint8Array
  checksumValid: boolean
  dataStart: number
}

function polymod(values: number[]): number {
  let chk = 1
  for (const v of values) {
    const top = chk >> 25
    chk = ((chk & 0x1ffffff) << 5) ^ v
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i]!
  }
  return chk
}

function hrpExpand(hrp: string): number[] {
  const high = [], low = []
  for (const c of hrp) {
    high.push(c.charCodeAt(0) >> 5)
    low.push(c.charCodeAt(0) & 31)
  }
  return [...high, 0, ...low]
}

export function decodeBech32Tolerant(raw: string): Decoded<Bech32Result | null> {
  const diagnostics: Diagnostic[] = []
  const input = raw.trim()

  if (input !== input.toLowerCase() && input !== input.toUpperCase()) {
    return { value: null, diagnostics: [err('Mixed upper and lower case is not valid bech32.', 'BOLT11 bech32')] }
  }
  const s = input.toLowerCase()

  const sep = s.lastIndexOf('1')
  if (sep < 1 || sep + 7 > s.length) {
    return { value: null, diagnostics: [err('Not a bech32 string: no separator, or nothing after it.', 'BOLT11 bech32')] }
  }

  const hrp = s.slice(0, sep)
  const dataStart = sep + 1
  const values: number[] = []
  for (let i = dataStart; i < s.length; i++) {
    const v = CHARSET.indexOf(s[i]!)
    if (v === -1) {
      return {
        value: null,
        diagnostics: [err(`Character '${s[i]}' at position ${i} is not valid bech32.`, 'BOLT11 bech32')],
      }
    }
    values.push(v)
  }

  const checksumValid = polymod([...hrpExpand(hrp), ...values]) === 1
  if (!checksumValid) {
    diagnostics.push(specWarn(
      'Checksum is invalid — no implementation will accept this invoice. Decoding continues anyway.',
      'BOLT11 bech32',
    ))
  }

  return {
    value: { hrp, words: Uint8Array.from(values.slice(0, -6)), checksumValid, dataStart },
    diagnostics,
  }
}

export function encodeBech32(hrp: string, words: Uint8Array, constant = 1): string {
  const values = [...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]
  const mod = polymod(values) ^ constant
  const checksum = Array.from({ length: 6 }, (_, i) => CHARSET[(mod >> (5 * (5 - i))) & 31]!)
  return hrp + '1' + Array.from(words, w => CHARSET[w]!).join('') + checksum.join('')
}
