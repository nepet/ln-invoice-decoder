import { specWarn } from '../domain/diagnostics'
import type { Decoded, Diagnostic, Feature, RawField } from '../domain/types'

/** BOLT9, by even (required) bit. The odd bit of each pair is even + 1. */
const FEATURE_NAMES: Record<number, string> = {
  0: 'option_data_loss_protect',
  4: 'option_upfront_shutdown_script',
  6: 'gossip_queries',
  8: 'var_onion_optin',
  10: 'gossip_queries_ex',
  12: 'option_static_remotekey',
  14: 'payment_secret',
  16: 'basic_mpp',
  18: 'option_support_large_channel',
  26: 'option_anchors',
  44: 'option_route_blinding',
  48: 'payment_metadata',
  54: 'option_zeroconf',
}

const nameFor = (bit: number): string | null => FEATURE_NAMES[bit] ?? FEATURE_NAMES[bit - 1] ?? null

export function decodeFeatures(field: RawField): Decoded<Feature[]> {
  const diagnostics: Diagnostic[] = []
  const features: Feature[] = []
  const words = field.words

  for (let i = 0; i < words.length; i++) {
    const word = words[words.length - 1 - i]!
    for (let j = 0; j < 5; j++) {
      if (!((word >> j) & 1)) continue
      const bit = i * 5 + j
      const name = nameFor(bit)
      const required = bit % 2 === 0
      features.push({ bit, name, required })
      if (!name && required) {
        diagnostics.push(specWarn(
          `Feature bit ${bit} is unknown and even, so it is required; a compliant payer MUST refuse this invoice.`,
          'BOLT9 feature bits', { field: '9' },
        ))
      }
    }
  }

  return { value: features.sort((a, b) => a.bit - b.bit), diagnostics }
}
