// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFragment, writeFragment } from '../src/ui/fragment'
import { SPEC_COFFEE } from './fixtures/invoices'

describe('fragment', () => {
  beforeEach(() => { history.replaceState(null, '', '/') })

  it('reads an invoice out of the hash', () => {
    expect(readFragment('#' + SPEC_COFFEE)).toBe(SPEC_COFFEE)
    expect(readFragment('')).toBe('')
  })

  it('writes with replaceState, never pushState', () => {
    const push = vi.spyOn(history, 'pushState')
    writeFragment(SPEC_COFFEE)
    expect(location.hash).toBe('#' + SPEC_COFFEE)
    expect(location.search).toBe('')
    expect(push).not.toHaveBeenCalled()
  })

  it('clears the hash when given an empty invoice', () => {
    writeFragment(SPEC_COFFEE)
    writeFragment('')
    expect(location.hash).toBe('')
  })
})
