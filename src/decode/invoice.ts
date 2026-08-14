import { specWarn } from '../domain/diagnostics'
import { infoDiagnostics, practiceDiagnostics } from '../practice/rules'
import type { DecodedField, DecodedInvoice, Diagnostic, RouteHint } from '../domain/types'
import { decodeBech32Tolerant } from './bech32'
import { splitDataPart, TAG_NAMES } from './fields'
import { decodeFallback } from './fallback'
import { decodeFeatures } from './features'
import { parseHrp } from './hrp'
import { decodeRouteHint, hintCost, validateHint } from './routeHints'
import { recoverPayee } from './signature'
import { checkLength, decodeDescription, decodeHexField, decodeIntField } from './simpleFields'
import { bytesToHex, wordsToBytes } from './words'

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 } as const

export function decodeInvoice(input: string, now: Date = new Date()): DecodedInvoice {
  const diagnostics: Diagnostic[] = []
  const inv: DecodedInvoice = {
    input,
    hrp: { raw: '', network: null, amountMsat: null },
    timestamp: null, fields: [], payeeNodeId: null, signatureValid: false,
    paymentHash: null, paymentSecret: null, description: null, descriptionHash: null,
    expirySeconds: 3600, minFinalCltvExpiryDelta: 18, fallbackAddress: null,
    features: [], routeHints: [], diagnostics,
  }

  const bech32 = decodeBech32Tolerant(input)
  diagnostics.push(...bech32.diagnostics)
  // Nothing decoded: report only what bech32 said. Practice rules about missing
  // fields would be noise when there are no fields at all.
  if (!bech32.value) return sorted(inv)

  const hrp = parseHrp(bech32.value.hrp)
  inv.hrp = hrp.value
  diagnostics.push(...hrp.diagnostics)

  const parts = splitDataPart(bech32.value.words, bech32.value.dataStart)
  diagnostics.push(...parts.diagnostics)
  inv.timestamp = parts.value.timestamp

  // Signature first: the payee is needed to validate route hints.
  const dataWords = bech32.value.words.slice(0, bech32.value.words.length - parts.value.signatureWords.length)
  const sig = recoverPayee(bech32.value.hrp, dataWords, parts.value.signatureWords)
  diagnostics.push(...sig.diagnostics)
  inv.payeeNodeId = sig.value.payeeNodeId
  inv.signatureValid = sig.value.signatureValid

  const seen = new Set<string>()
  const hints: RouteHint[] = []

  for (const field of parts.value.fields) {
    const lengthDiagnostic = checkLength(field)
    if (lengthDiagnostic) diagnostics.push(lengthDiagnostic)

    const name = TAG_NAMES[field.tag] ?? 'unknown'
    let display = bytesToHex(wordsToBytes(field.words, true) ?? new Uint8Array())

    switch (field.tag) {
      case 'p': case 's': case 'h': case 'n': case 'm': {
        const r = decodeHexField(field)
        diagnostics.push(...r.diagnostics)
        display = r.value ?? display
        if (field.tag === 'p') inv.paymentHash = r.value
        if (field.tag === 's') inv.paymentSecret = r.value
        if (field.tag === 'h') inv.descriptionHash = r.value
        if (field.tag === 'n' && r.value && inv.payeeNodeId && r.value !== inv.payeeNodeId) {
          diagnostics.push(specWarn(
            'The n field disagrees with the key recovered from the signature.',
            'BOLT11 n field', { field: 'n' },
          ))
        }
        break
      }
      case 'd': {
        const r = decodeDescription(field)
        diagnostics.push(...r.diagnostics)
        inv.description = r.value
        display = r.value ?? display
        break
      }
      case 'x': inv.expirySeconds = decodeIntField(field); display = `${inv.expirySeconds} seconds`; break
      case 'c': inv.minFinalCltvExpiryDelta = decodeIntField(field); display = `${inv.minFinalCltvExpiryDelta} blocks`; break
      case '9': {
        const r = decodeFeatures(field)
        diagnostics.push(...r.diagnostics)
        inv.features = r.value
        display = r.value.map(f => f.name ?? `bit ${f.bit}`).join(', ')
        break
      }
      case 'f': {
        const r = decodeFallback(field, inv.hrp.network)
        diagnostics.push(...r.diagnostics)
        inv.fallbackAddress = r.value
        display = r.value ?? display
        break
      }
      case 'r': {
        const hintIndex = hints.length
        const r = decodeRouteHint(field, hintIndex)
        diagnostics.push(...r.diagnostics)
        diagnostics.push(...validateHint(r.value, hintIndex, inv.payeeNodeId, inv.hrp.amountMsat))
        hints.push({ hops: r.value, cost: hintCost(r.value, inv.hrp.amountMsat) })
        display = `${r.value.length} hop${r.value.length === 1 ? '' : 's'}`
        break
      }
    }

    if (field.tag !== 'r' && field.tag !== 'f' && seen.has(field.tag)) {
      diagnostics.push(specWarn(
        `Two '${field.tag}' fields; readers take the first.`,
        'BOLT11 tagged fields', { field: field.tag },
      ))
    }
    seen.add(field.tag)
    inv.fields.push({ tag: field.tag, name, display, raw: field } satisfies DecodedField)
  }

  inv.routeHints = hints

  if (!inv.description && !inv.descriptionHash) {
    diagnostics.push(specWarn('Invoice has neither a description nor a description hash.', 'BOLT11 tagged fields'))
  }
  if (inv.description !== null && inv.descriptionHash !== null) {
    diagnostics.push(specWarn('Invoice has both a description and a description hash.', 'BOLT11 tagged fields'))
  }

  return finish(inv, now)
}

function finish(inv: DecodedInvoice, now: Date): DecodedInvoice {
  inv.diagnostics.push(...practiceDiagnostics(inv), ...infoDiagnostics(inv, now))
  return sorted(inv)
}

function sorted(inv: DecodedInvoice): DecodedInvoice {
  inv.diagnostics.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return inv
}
