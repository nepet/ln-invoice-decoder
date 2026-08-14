import { specWarn } from '../domain/diagnostics'
import type { Decoded, Diagnostic, RawField } from '../domain/types'
import { TAG_NAMES } from './fields'
import { bytesToHex, wordsToBytes, wordsToNumber } from './words'

/** In 5-bit words. 52 words = 256 bits + 4 padding bits; 53 = 264 bits + 1. */
export const EXPECTED_LENGTHS: Record<string, number> = { p: 52, s: 52, h: 52, n: 53 }

export function checkLength(field: RawField): Diagnostic | null {
  const expected = EXPECTED_LENGTHS[field.tag]
  if (expected === undefined || field.dataLength === expected) return null
  return specWarn(
    `Field '${field.tag}' (${TAG_NAMES[field.tag]}) is ${field.dataLength} words, expected ${expected}. ` +
    `Spec-compliant readers MUST skip a known field of unexpected length, so they will behave as if it were absent.`,
    'BOLT11: "MUST skip over unknown fields, OR a field with unknown length"',
    { field: field.tag },
  )
}

export function decodeHexField(field: RawField): Decoded<string | null> {
  const bytes = wordsToBytes(field.words, false)
  if (!bytes) {
    return {
      value: bytesToHex(wordsToBytes(field.words, true)!),
      diagnostics: [specWarn(`Field '${field.tag}' has non-zero padding bits.`, 'BOLT11 tagged fields', { field: field.tag })],
    }
  }
  return { value: bytesToHex(bytes), diagnostics: [] }
}

export function decodeDescription(field: RawField): Decoded<string | null> {
  const bytes = wordsToBytes(field.words, false) ?? wordsToBytes(field.words, true)!
  try {
    return { value: new TextDecoder('utf-8', { fatal: true }).decode(bytes), diagnostics: [] }
  } catch {
    return {
      value: bytesToHex(bytes),
      diagnostics: [specWarn('Description is not valid UTF-8; shown as hex.', 'BOLT11 d field', { field: 'd' })],
    }
  }
}

export function decodeIntField(field: RawField): number {
  return wordsToNumber(field.words)
}
