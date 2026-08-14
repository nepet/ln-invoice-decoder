import { secp256k1 } from '@noble/curves/secp256k1'
import { sha256 } from '@noble/hashes/sha256'
import { specWarn } from '../domain/diagnostics'
import type { Decoded, Diagnostic } from '../domain/types'
import { bytesToHex, wordsToBytes } from './words'

export interface SignatureResult {
  payeeNodeId: string | null
  signatureValid: boolean
}

export function recoverPayee(
  hrp: string, dataWords: Uint8Array, signatureWords: Uint8Array,
): Decoded<SignatureResult> {
  const diagnostics: Diagnostic[] = []
  const failed: SignatureResult = { payeeNodeId: null, signatureValid: false }

  const sigBytes = wordsToBytes(signatureWords, true)
  if (!sigBytes || sigBytes.length !== 65) {
    diagnostics.push(specWarn('Signature is malformed; the payee cannot be determined.', 'BOLT11 signature'))
    return { value: failed, diagnostics }
  }

  const message = new Uint8Array([
    ...new TextEncoder().encode(hrp),
    ...wordsToBytes(dataWords, true)!,
  ])
  const hash = sha256(message)

  try {
    const recovery = sigBytes[64]!
    const pubkey = secp256k1.Signature
      .fromCompact(sigBytes.slice(0, 64))
      .addRecoveryBit(recovery)
      .recoverPublicKey(hash)
      .toRawBytes(true)
    return { value: { payeeNodeId: bytesToHex(pubkey), signatureValid: true }, diagnostics }
  } catch {
    diagnostics.push(specWarn('Signature does not recover a public key; the payee cannot be determined.', 'BOLT11 signature'))
    return { value: failed, diagnostics }
  }
}
