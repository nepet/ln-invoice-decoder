import { info, practiceWarn } from '../domain/diagnostics'
import type { DecodedInvoice, Diagnostic } from '../domain/types'

/** Diagnostics that come from how implementations behave, not from the spec. */
export function practiceDiagnostics(inv: DecodedInvoice): Diagnostic[] {
  const out: Diagnostic[] = []

  if (!inv.paymentSecret) {
    out.push(practiceWarn(
      'No payment secret; LND and CLN decline to pay this invoice. Legal per BOLT11.',
      ['LND', 'CLN'], { field: 's' },
    ))
  } else if (!inv.features.some(f => f.bit === 14 || f.bit === 15)) {
    out.push(practiceWarn(
      'Payment secret is present but not signalled in the feature bits.',
      ['LND', 'CLN', 'LDK'], { field: '9' },
    ))
  }

  return out
}

/**
 * Observations about Tagged Fields the Invoice does *not* carry. Separated from
 * `infoDiagnostics` because they are only meaningful once the field walk
 * actually completed: on a truncated Invoice, "no expiry set" is not a fact
 * about the Invoice, it is a fact about where decoding stopped.
 */
export function absenceDiagnostics(inv: DecodedInvoice): Diagnostic[] {
  const out: Diagnostic[] = []

  if (!inv.fields.some(f => f.tag === 'x')) {
    out.push(info('No expiry set; the default of 3600 seconds applies.'))
  }
  if (!inv.fields.some(f => f.tag === 'c')) {
    out.push(info('No minimum final CLTV set; the default of 18 blocks applies.'))
  }
  // The tool leads with "payee recovered", and this is what that does and does
  // not establish. It only makes sense once a Payee was in fact recovered.
  if (!inv.fields.some(f => f.tag === 'n') && inv.payeeNodeId !== null) {
    out.push(info(
      'No n field, so the payee above is recovered from the signature rather than checked against a key ' +
      'the invoice names. Any well-formed signature recovers some payee, so a tampered invoice yields a ' +
      'different payee rather than an invalid signature — compare it with the payee you expect.',
    ))
  }

  return out
}

/** Legal-but-notable observations. */
export function infoDiagnostics(inv: DecodedInvoice, now: Date): Diagnostic[] {
  const out: Diagnostic[] = []
  const seconds = Math.floor(now.getTime() / 1000)

  if (inv.hrp.amountMsat === null) {
    out.push(info('Zero-amount invoice; the payer chooses the amount, so hint cost cannot be computed.'))
  }
  if (inv.timestamp !== null) {
    const expiresAt = inv.timestamp + inv.expirySeconds
    if (seconds > expiresAt) {
      out.push(info(`Expired ${Math.floor((seconds - expiresAt) / 60)} minutes ago.`, { field: 'x' }))
    }
    if (inv.timestamp > seconds + 60) {
      out.push(info(`Created ${Math.floor((inv.timestamp - seconds) / 60)} minutes in the future, by this machine's clock.`))
    }
  }
  if (inv.routeHints.length > 1) {
    out.push(info(`${inv.routeHints.length} route hints; a payer may try any of them.`, { field: 'r' }))
  }
  for (const f of inv.fields) {
    if (f.name === 'unknown') {
      out.push(info(`Field '${f.tag}' is not a type this tool knows; raw words shown.`, { field: f.tag }))
    }
  }
  return out
}
