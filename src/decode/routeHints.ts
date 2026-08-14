import { info, practiceWarn, specWarn } from '../domain/diagnostics'
import type { Decoded, Diagnostic, HintCost, Hop, RawField } from '../domain/types'
import { bytesToHex, wordsToBytes } from './words'

const HOP_BYTES = 51

export function decodeRouteHint(field: RawField, hintIndex: number): Decoded<Hop[]> {
  const diagnostics: Diagnostic[] = []
  const bytes = wordsToBytes(field.words, false) ?? wordsToBytes(field.words, true)!
  const whole = Math.floor(bytes.length / HOP_BYTES)

  if (bytes.length % HOP_BYTES !== 0) {
    diagnostics.push(specWarn(
      `Route hint is ${bytes.length} bytes, not a whole number of hops (51 bytes each). ` +
      `Reading the first ${whole}.`,
      'BOLT11 r field', { field: 'r', hintIndex },
    ))
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const hops: Hop[] = []
  for (let i = 0; i < whole; i++) {
    const at = i * HOP_BYTES
    const scid = view.getBigUint64(at + 33)
    hops.push({
      nodeId: bytesToHex(bytes.slice(at, at + 33)),
      scid: {
        block: Number(scid >> 40n),
        tx: Number((scid >> 16n) & 0xffffffn),
        output: Number(scid & 0xffffn),
        raw: scid.toString(),
      },
      feeBaseMsat: view.getUint32(at + 41),
      feeProportionalMillionths: view.getUint32(at + 45),
      cltvExpiryDelta: view.getUint16(at + 49),
    })
  }

  return { value: hops, diagnostics }
}

/**
 * Total fee and CLTV a hint adds. Computed backwards from the Payee: a Hop's
 * proportional fee applies to what it forwards, which includes the fees of
 * every Hop after it. Null when the Invoice has no Amount — never estimated.
 */
export function hintCost(hops: Hop[], amountMsat: bigint | null): HintCost | null {
  if (amountMsat === null) return null
  let forwarded = amountMsat
  let feeMsat = 0n
  for (let i = hops.length - 1; i >= 0; i--) {
    const h = hops[i]!
    const fee = BigInt(h.feeBaseMsat) + (forwarded * BigInt(h.feeProportionalMillionths)) / 1_000_000n
    feeMsat += fee
    forwarded += fee
  }
  return { feeMsat, cltvDelta: hops.reduce((sum, h) => sum + h.cltvExpiryDelta, 0) }
}

export function validateHint(
  hops: Hop[], hintIndex: number, payeeNodeId: string | null, amountMsat: bigint | null,
): Diagnostic[] {
  const out: Diagnostic[] = []
  const anchor = { field: 'r', hintIndex }

  hops.forEach((h, hopIndex) => {
    if (h.scid.raw === '0') {
      out.push(specWarn(
        `Hop ${hopIndex + 1}'s channel is 0x0x0; no payer can build this leg.`,
        'BOLT11 r field', { ...anchor, hopIndex },
      ))
    }
    if (payeeNodeId && h.nodeId === payeeNodeId) {
      out.push(specWarn(
        `Hop ${hopIndex + 1} points at the payee, but the payee is implicit one step past the last hop and must not appear.`,
        'BOLT11 r field', { ...anchor, hopIndex },
      ))
    }
    if (h.cltvExpiryDelta === 0) {
      out.push(practiceWarn(
        `Hop ${hopIndex + 1} has a CLTV delta of 0; forwarding nodes reject this. Legal per BOLT11.`,
        ['LND', 'CLN', 'LDK'], { ...anchor, hopIndex },
      ))
    }
    const first = hops.findIndex(x => x.nodeId === h.nodeId)
    if (first !== hopIndex) {
      out.push(specWarn(
        `Hop ${hopIndex + 1} repeats the public key ${h.nodeId.slice(0, 10)}… of hop ${first + 1}.`,
        'BOLT11 r field', { ...anchor, hopIndex },
      ))
    }
  })

  if (hops.length > 3) {
    out.push(info(`Route hint has ${hops.length} hops, which is unusually long.`, anchor))
  }

  const cost = hintCost(hops, amountMsat)
  if (cost && amountMsat && amountMsat > 0n && cost.feeMsat * 20n > amountMsat) {
    out.push(practiceWarn(
      `Route hint adds ${cost.feeMsat} msat, over 5% of the amount; wallets with default fee limits will not attempt it.`,
      ['most wallets'], anchor,
    ))
  }

  return out
}
