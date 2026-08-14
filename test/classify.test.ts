import { describe, it, expect } from 'vitest'
import { classify, normaliseInput } from '../src/classify'
import { SPEC_COFFEE } from './fixtures/invoices'

describe('normaliseInput', () => {
  it('strips a lightning: URI prefix and lowercases QR uppercase', () => {
    expect(normaliseInput(' LIGHTNING:' + SPEC_COFFEE.toUpperCase() + ' ')).toBe(SPEC_COFFEE)
  })
})

describe('classify', () => {
  it('recognises a bolt11 invoice', () => {
    expect(classify(SPEC_COFFEE).kind).toBe('bolt11')
  })

  it('names a bolt12 offer instead of failing to parse it', () => {
    const r = classify('lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy6tsw35k7msjzfpy7nz5yqcnygrfdej82um5wf5k2uckyypwa3eyt44h6txtxquqh7lz5djge4afgfjn7k4rgrkuag0jsd5xvxg')
    expect(r.kind).toBe('bolt12-offer')
    expect(r.message).toMatch(/BOLT12 offer/)
    expect(r.message).toMatch(/BOLT11/)
  })

  it('recognises lnurl, node uris and bitcoin addresses', () => {
    expect(classify('LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS').kind).toBe('lnurl')
    expect(classify('03864ef025fde8fb587d989186ce6a4a186895ee44a926bfc370e2c366597a3f8f@1.2.3.4:9735').kind).toBe('node-uri')
    expect(classify('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4').kind).toBe('bitcoin-address')
  })

  it('reports empty input as empty, not as an error', () => {
    expect(classify('   ').kind).toBe('empty')
  })
})
