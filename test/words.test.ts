import { describe, it, expect } from 'vitest'
import { bytesToHex, wordsToBytes, wordsToNumber } from '../src/decode/words'

describe('word helpers', () => {
  it('converts 5-bit words to bytes, dropping zero padding', () => {
    // 8 words × 5 bits = 40 bits = exactly 5 bytes
    const words = Uint8Array.from([31, 31, 31, 31, 31, 31, 31, 31])
    expect(bytesToHex(wordsToBytes(words, false)!)).toBe('ffffffffff')
  })

  it('drops trailing padding bits when they are zero', () => {
    // 2 words = 10 bits → 1 byte + 2 zero bits
    expect(wordsToBytes(Uint8Array.from([31, 28]), false)).toEqual(Uint8Array.from([0xff]))
  })

  it('rejects non-zero padding when strict', () => {
    expect(wordsToBytes(Uint8Array.from([31, 31]), false)).toBeNull()
  })

  it('keeps padding bits when asked to pad', () => {
    expect(wordsToBytes(Uint8Array.from([31, 31]), true)).toEqual(Uint8Array.from([0xff, 0xc0]))
  })

  it('reads big-endian numbers', () => {
    expect(wordsToNumber(Uint8Array.from([1, 0]))).toBe(32)
    expect(wordsToNumber(Uint8Array.from([1, 0, 0]))).toBe(1024)
  })
})
