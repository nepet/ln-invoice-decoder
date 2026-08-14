import type { DecodedInvoice } from '../domain/types'

export function toJson(inv: DecodedInvoice): string {
  return JSON.stringify(inv, (key, value) => {
    if (typeof value === 'bigint') return value.toString()
    if (key === 'words' && value instanceof Uint8Array) return undefined
    return value
  }, 2)
}

export function wireCopyButtons(root: HTMLElement): void {
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-copy]')
    if (!target) return
    void navigator.clipboard?.writeText(target.dataset.copy ?? '')
    const previous = target.getAttribute('data-copied')
    target.setAttribute('data-copied', 'true')
    setTimeout(() => { if (previous === null) target.removeAttribute('data-copied') }, 1200)
  })
}
