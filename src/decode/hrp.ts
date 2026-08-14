import { err, specWarn } from '../domain/diagnostics'
import type { Decoded, Diagnostic, Hrp, Network } from '../domain/types'

/** Longest first — 'bcrt' must beat 'bc', 'tbs' must beat 'tb'. */
const PREFIXES: [string, Network][] = [
  ['bcrt', 'regtest'],
  ['tbs', 'signet'],
  ['bc', 'mainnet'],
  ['tb', 'testnet'],
  ['sb', 'simnet'],
]

/** Millisatoshi per unit of the amount, before the multiplier. */
const MSAT_PER_BTC = 100_000_000_000n
const MULTIPLIERS: Record<string, bigint> = { m: 1_000n, u: 1_000_000n, n: 1_000_000_000n, p: 1_000_000_000_000n }

export function parseHrp(hrp: string): Decoded<Hrp> {
  const diagnostics: Diagnostic[] = []
  const empty: Hrp = { raw: hrp, network: null, amountMsat: null }

  if (!hrp.startsWith('ln')) {
    return { value: empty, diagnostics: [err('Not a Lightning invoice: the prefix is not "ln".', 'BOLT11 human-readable part')] }
  }

  const rest = hrp.slice(2)
  const match = PREFIXES.find(([p]) => rest.startsWith(p))
  if (!match) {
    diagnostics.push(specWarn(`Unknown network prefix in "${hrp}".`, 'BOLT11 human-readable part'))
    return { value: empty, diagnostics }
  }

  const network = match[1]
  const amountPart = rest.slice(match[0].length)
  if (amountPart === '') return { value: { raw: hrp, network, amountMsat: null }, diagnostics }

  const m = /^(\d+)([munp])?$/.exec(amountPart)
  if (!m) {
    diagnostics.push(specWarn(`Amount "${amountPart}" is not a number with an optional m, u, n, or p multiplier.`, 'BOLT11 human-readable part'))
    return { value: { raw: hrp, network, amountMsat: null }, diagnostics }
  }

  const digits = BigInt(m[1]!)
  const multiplier = m[2]
  let amountMsat: bigint
  if (!multiplier) {
    amountMsat = digits * MSAT_PER_BTC
  } else {
    const divisor = MULTIPLIERS[multiplier]!
    amountMsat = (digits * MSAT_PER_BTC) / divisor
    if (multiplier === 'p' && digits % 10n !== 0n) {
      diagnostics.push(specWarn(
        `Amount ${amountPart} is not a whole millisatoshi; the final digit of a "p" amount must be 0.`,
        'BOLT11 human-readable part',
      ))
    }
  }

  return { value: { raw: hrp, network, amountMsat }, diagnostics }
}
