import { err } from '../domain/diagnostics'
import type { Decoded, Diagnostic, RawField } from '../domain/types'
import { wordsToNumber } from './words'

export const TAG_NAMES: Record<string, string> = {
  p: 'payment_hash',
  s: 'payment_secret',
  d: 'description',
  n: 'payee_node_id',
  h: 'description_hash',
  x: 'expiry',
  c: 'min_final_cltv_expiry_delta',
  f: 'fallback_address',
  r: 'route_hint',
  '9': 'features',
  m: 'metadata',
}

const TIMESTAMP_WORDS = 7
const SIGNATURE_WORDS = 104

export interface DataPart {
  timestamp: number | null
  fields: RawField[]
  signatureWords: Uint8Array
}

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

export function splitDataPart(words: Uint8Array, dataStart: number): Decoded<DataPart> {
  const diagnostics: Diagnostic[] = []
  const empty: DataPart = { timestamp: null, fields: [], signatureWords: new Uint8Array() }

  if (words.length < TIMESTAMP_WORDS + SIGNATURE_WORDS) {
    return { value: empty, diagnostics: [err('Invoice is truncated: too short to hold a timestamp and a signature.', 'BOLT11 data part')] }
  }

  const timestamp = wordsToNumber(words.slice(0, TIMESTAMP_WORDS))
  const sigStart = words.length - SIGNATURE_WORDS
  const signatureWords = words.slice(sigStart)

  const fields: RawField[] = []
  let i = TIMESTAMP_WORDS
  while (i < sigStart) {
    const type = words[i]!
    const tag = CHARSET[type]!
    if (i + 3 > sigStart) {
      diagnostics.push(err(`Field '${tag}' is cut off before its length could be read.`, 'BOLT11 tagged fields', { field: tag }))
      break
    }
    const dataLength = words[i + 1]! * 32 + words[i + 2]!
    if (i + 3 + dataLength > sigStart) {
      diagnostics.push(err(
        `Field '${tag}' declares ${dataLength} words but only ${sigStart - i - 3} remain before the signature.`,
        'BOLT11 tagged fields', { field: tag },
      ))
      break
    }
    fields.push({
      tag, type, dataLength,
      words: words.slice(i + 3, i + 3 + dataLength),
      span: { start: dataStart + i, end: dataStart + i + 3 + dataLength },
    })
    i += 3 + dataLength
  }

  return { value: { timestamp, fields, signatureWords }, diagnostics }
}
