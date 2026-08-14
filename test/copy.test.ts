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
})
