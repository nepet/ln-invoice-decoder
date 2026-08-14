// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { decodeImageData, startCamera } from '../src/ui/qr'
import { SPEC_COFFEE } from './fixtures/invoices'

vi.mock('jsqr', () => ({
  default: vi.fn(() => ({ data: 'LIGHTNING:' + SPEC_COFFEE.toUpperCase() })),
}))

describe('decodeImageData', () => {
  it('normalises an uppercase lightning: QR payload', () => {
    const image = { data: new Uint8ClampedArray(4), width: 1, height: 1 } as ImageData
    expect(decodeImageData(image)).toBe(SPEC_COFFEE)
  })
})

describe('startCamera', () => {
  it('stops every track when the returned stop function is called', async () => {
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    Object.assign(navigator, { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) } })
    const video = document.createElement('video')
    const halt = startCamera(video, () => {})
    await Promise.resolve()
    halt()
    await Promise.resolve()
    expect(stop).toHaveBeenCalled()
  })
})
