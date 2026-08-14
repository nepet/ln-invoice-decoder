// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { mount } from '../src/ui/main'
import { SPEC_COFFEE } from './fixtures/invoices'

const type = (root: HTMLElement, text: string) => {
  const input = root.querySelector('textarea')!
  input.value = text
  input.dispatchEvent(new Event('input'))
}

describe('mount', () => {
  it('shows the empty state before anything is pasted', () => {
    const root = document.createElement('div')
    mount(root)
    expect(root.querySelector('[data-empty]')).not.toBeNull()
    expect(root.querySelector('[data-section="verdict"]')).toBeNull()
  })

  it('decodes on input and writes the fragment', () => {
    const root = document.createElement('div')
    mount(root)
    type(root, SPEC_COFFEE)
    expect(root.querySelector('[data-section="verdict"]')).not.toBeNull()
    expect(location.hash).toBe('#' + SPEC_COFFEE)
  })

  it('names a bolt12 offer instead of showing a decode failure', () => {
    const root = document.createElement('div')
    mount(root)
    type(root, 'lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy6tsw35k7msjzfpy7nz5yq')
    expect(root.textContent).toMatch(/BOLT12 offer/)
  })

  it('loads the example invoice from the example button', () => {
    const root = document.createElement('div')
    mount(root)
    root.querySelector<HTMLButtonElement>('[data-example]')!.click()
    expect(root.querySelector('[data-section="route-hints"]')).not.toBeNull()
  })

  it('survives a malformed percent escape in the fragment on load', () => {
    // Assigned raw, unencoded — a hand-edited or shared URL can carry this
    // literally, and encoding it first would hide the bug this covers.
    history.replaceState(null, '', '/#%zz')
    const root = document.createElement('div')
    expect(() => mount(root)).not.toThrow()
    expect(root.querySelector('textarea')).not.toBeNull()
  })

  it('keeps an open raw expander open, and the same node, across a countdown tick', () => {
    vi.useFakeTimers()
    const root = document.createElement('div')
    document.body.append(root)
    try {
      mount(root)
      type(root, SPEC_COFFEE)
      const details = root.querySelector('details')!
      details.open = true
      const expiry = root.querySelector('[data-expiry]')!
      const before = expiry.textContent

      vi.advanceTimersByTime(61_000)

      expect(root.querySelector('details')).toBe(details)
      expect(details.open).toBe(true)
      // The countdown still runs — it just rewrites one text node in place.
      expect(root.querySelector('[data-expiry]')).toBe(expiry)
      expect(expiry.textContent).not.toBe(before)
    } finally {
      root.remove()
      vi.useRealTimers()
    }
  })

  it('runs one countdown however many times it is mounted', () => {
    vi.useFakeTimers()
    const root = document.createElement('div')
    document.body.append(root)
    try {
      mount(root)
      mount(root)
      mount(root)
      expect(vi.getTimerCount()).toBe(1)
    } finally {
      root.remove()
      vi.useRealTimers()
    }
  })

  it('never references the network in ui source', () => {
    for (const file of readdirSync('src/ui')) {
      const source = readFileSync(`src/ui/${file}`, 'utf8')
      expect(source).not.toMatch(/\bfetch\(|XMLHttpRequest|pushState|location\.search/)
    }
  })
})
