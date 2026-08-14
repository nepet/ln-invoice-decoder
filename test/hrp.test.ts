import { describe, it, expect } from 'vitest'
import { parseHrp } from '../src/decode/hrp'

describe('parseHrp', () => {
  it('reads network and no amount', () => {
    const { value } = parseHrp('lnbc')
    expect(value.network).toBe('mainnet')
    expect(value.amountMsat).toBeNull()
  })

  it('reads each multiplier as millisatoshi', () => {
    expect(parseHrp('lnbc1').value.amountMsat).toBe(100_000_000_000n)   // 1 BTC
    expect(parseHrp('lnbc1m').value.amountMsat).toBe(100_000_000n)
    expect(parseHrp('lnbc2500u').value.amountMsat).toBe(250_000_000n)
    expect(parseHrp('lnbc1n').value.amountMsat).toBe(100n)
    expect(parseHrp('lnbc10p').value.amountMsat).toBe(1n)
  })

  it('handles amounts beyond Number.MAX_SAFE_INTEGER', () => {
    expect(parseHrp('lnbc21000000').value.amountMsat).toBe(2_100_000_000_000_000_000n)
  })

  it('matches the longer prefix first', () => {
    expect(parseHrp('lnbcrt500u').value.network).toBe('regtest')
    expect(parseHrp('lntbs1m').value.network).toBe('signet')
    expect(parseHrp('lntb1m').value.network).toBe('testnet')
  })

  it('warns when a p amount is not a whole millisatoshi', () => {
    const { value, diagnostics } = parseHrp('lnbc1p')
    expect(value.amountMsat).toBe(0n)
    expect(diagnostics.some(d => d.severity === 'warning' && /millisatoshi/.test(d.message))).toBe(true)
  })

  it('errors on a non-lightning prefix', () => {
    const { value, diagnostics } = parseHrp('bc1qxyz')
    expect(value.network).toBeNull()
    expect(diagnostics[0]!.severity).toBe('error')
  })

  it('warns on an unknown lightning network prefix', () => {
    const { value, diagnostics } = parseHrp('lnxyz1m')
    expect(value.network).toBeNull()
    expect(diagnostics.some(d => d.severity === 'warning')).toBe(true)
  })
})
