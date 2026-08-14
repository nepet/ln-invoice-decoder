// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { decodeInvoice } from '../src/decode/invoice'
import { toJson, wireCopyButtons } from '../src/ui/copy'
import { SPEC_ROUTE_HINT } from './fixtures/invoices'

describe('toJson', () => {
  it('serialises bigint amounts as decimal strings', () => {
    const json = JSON.parse(toJson(decodeInvoice(SPEC_ROUTE_HINT)))
    expect(json.hrp.amountMsat).toBe('2000000000')
    expect(json.routeHints[0].cost.feeMsat).toMatch(/^\d+$/)
  })

  it('keeps diagnostics and their sources', () => {
    const json = JSON.parse(toJson(decodeInvoice(SPEC_ROUTE_HINT)))
    expect(Array.isArray(json.diagnostics)).toBe(true)
    expect(json.diagnostics[0].source.kind).toMatch(/spec|practice|tool/)
  })

  it('round-trips through JSON.parse without throwing', () => {
    expect(() => JSON.parse(toJson(decodeInvoice('lnbc')))).not.toThrow()
  })
})

describe('wireCopyButtons', () => {
  it('copies the value of the clicked element', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const root = document.createElement('div')
    root.innerHTML = '<button data-copy="03abc">copy</button>'
    wireCopyButtons(root)
    root.querySelector('button')!.click()
    expect(writeText).toHaveBeenCalledWith('03abc')
  })

  it('leaves the clipboard alone when the click ended a selection inside the value', () => {
    // Click-dragging across part of a public key fires click on mouseup;
    // copying the whole value then would overwrite what was highlighted.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const root = document.createElement('div')
    document.body.append(root)
    root.innerHTML = '<span data-copy="03abcdef">03abcdef</span>'
    wireCopyButtons(root)
    const span = root.querySelector('span')!

    const range = document.createRange()
    range.setStart(span.firstChild!, 0)
    range.setEnd(span.firstChild!, 4)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)

    span.click()
    expect(writeText).not.toHaveBeenCalled()

    // A plain click — the browser has collapsed the selection by mousedown —
    // still copies.
    selection.removeAllRanges()
    span.click()
    expect(writeText).toHaveBeenCalledWith('03abcdef')
    root.remove()
  })
})
