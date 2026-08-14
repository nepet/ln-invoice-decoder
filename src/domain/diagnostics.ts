import type { Anchor, Diagnostic } from './types'

export const err = (message: string, rule: string, anchor: Anchor = {}): Diagnostic => ({
  severity: 'error', message, source: { kind: 'spec', rule }, ...anchor,
})

export const specWarn = (message: string, rule: string, anchor: Anchor = {}): Diagnostic => ({
  severity: 'warning', message, source: { kind: 'spec', rule }, ...anchor,
})

export const practiceWarn = (
  message: string, implementations: string[], anchor: Anchor = {},
): Diagnostic => ({
  severity: 'warning', message, source: { kind: 'practice', implementations }, ...anchor,
})

export const info = (message: string, anchor: Anchor = {}): Diagnostic => ({
  severity: 'info', message, source: { kind: 'tool' }, ...anchor,
})
