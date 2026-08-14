export function wordsToBytes(words: Uint8Array, pad: boolean): Uint8Array | null {
  let acc = 0
  let bits = 0
  const out: number[] = []
  for (const w of words) {
    acc = (acc << 5) | w
    bits += 5
    while (bits >= 8) {
      bits -= 8
      out.push((acc >> bits) & 0xff)
    }
  }
  const leftover = acc & ((1 << bits) - 1)
  if (pad) {
    if (bits > 0) out.push((leftover << (8 - bits)) & 0xff)
  } else if (bits >= 5 || leftover !== 0) {
    return null
  }
  return Uint8Array.from(out)
}

export function wordsToNumber(words: Uint8Array): number {
  let n = 0
  for (const w of words) n = n * 32 + w
  return n
}

export function wordsToBigInt(words: Uint8Array): bigint {
  let n = 0n
  for (const w of words) n = n * 32n + BigInt(w)
  return n
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}
