import { sha256 } from '@noble/hashes/sha256'
import { specWarn } from '../domain/diagnostics'
import type { Decoded, Diagnostic, Network, RawField } from '../domain/types'
import { encodeBech32 } from './bech32'
import { wordsToBytes } from './words'

const BECH32M = 0x2bc830a3
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const SEGWIT_HRP: Record<Network, string> = {
  mainnet: 'bc', testnet: 'tb', signet: 'tb', regtest: 'bcrt', simnet: 'sb',
}
const P2PKH_VERSION: Record<Network, number> = { mainnet: 0x00, testnet: 0x6f, signet: 0x6f, regtest: 0x6f, simnet: 0x6f }
const P2SH_VERSION: Record<Network, number> = { mainnet: 0x05, testnet: 0xc4, signet: 0xc4, regtest: 0xc4, simnet: 0xc4 }

function base58check(version: number, payload: Uint8Array): string {
  const body = Uint8Array.from([version, ...payload])
  const checksum = sha256(sha256(body)).slice(0, 4)
  const full = Uint8Array.from([...body, ...checksum])
  let n = full.reduce((acc, b) => acc * 256n + BigInt(b), 0n)
  let out = ''
  while (n > 0n) {
    out = B58[Number(n % 58n)]! + out
    n /= 58n
  }
  for (const b of full) {
    if (b !== 0) break
    out = '1' + out
  }
  return out
}

export function decodeFallback(field: RawField, network: Network | null): Decoded<string | null> {
  const diagnostics: Diagnostic[] = []
  const net = network ?? 'mainnet'
  if (network === null) {
    diagnostics.push(specWarn('Invoice network is unknown; the fallback address is rendered as mainnet.', 'BOLT11 f field', { field: 'f' }))
  }

  const version = field.words[0]
  if (version === undefined) {
    diagnostics.push(specWarn('Fallback address field is empty.', 'BOLT11 f field', { field: 'f' }))
    return { value: null, diagnostics }
  }

  const program = wordsToBytes(field.words.slice(1), false)
  if (!program) {
    diagnostics.push(specWarn('Fallback address has non-zero padding bits.', 'BOLT11 f field', { field: 'f' }))
    return { value: null, diagnostics }
  }

  if (version === 17 || version === 18) {
    const table = version === 17 ? P2PKH_VERSION : P2SH_VERSION
    return { value: base58check(table[net], program), diagnostics }
  }

  if (version <= 16) {
    const words = Uint8Array.from([version, ...field.words.slice(1)])
    return { value: encodeBech32(SEGWIT_HRP[net], words, version === 0 ? 1 : BECH32M), diagnostics }
  }

  diagnostics.push(specWarn(`Fallback address version ${version} is not a known address type.`, 'BOLT11 f field', { field: 'f' }))
  return { value: null, diagnostics }
}
