import { describe, it, expect } from 'vitest'
import { err, info, practiceWarn, specWarn } from '../src/domain/diagnostics'

describe('diagnostic constructors', () => {
  it('cites the rule for a spec warning', () => {
    const d = specWarn('p is 51 words, expected 52', 'BOLT11 tagged fields', { field: 'p' })
    expect(d).toEqual({
      severity: 'warning',
      message: 'p is 51 words, expected 52',
      source: { kind: 'spec', rule: 'BOLT11 tagged fields' },
      field: 'p',
    })
  })

  it('names the implementations for a practice warning', () => {
    const d = practiceWarn('No payment secret', ['LND', 'CLN'], { field: 's' })
    expect(d.severity).toBe('warning')
    expect(d.source).toEqual({ kind: 'practice', implementations: ['LND', 'CLN'] })
  })

  it('anchors a diagnostic to a hop inside a hint', () => {
    const d = specWarn('scid is 0x0x0', 'BOLT11 r field', { field: 'r', hintIndex: 0, hopIndex: 1 })
    expect(d.hintIndex).toBe(0)
    expect(d.hopIndex).toBe(1)
  })

  it('marks errors and infos with the right severity', () => {
    expect(err('truncated', 'BOLT11').severity).toBe('error')
    expect(info('no expiry set').severity).toBe('info')
  })
})
