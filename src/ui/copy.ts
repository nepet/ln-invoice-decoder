import type { DecodedInvoice } from '../domain/types'

export function toJson(inv: DecodedInvoice): string {
  return JSON.stringify(inv, (key, value) => {
    if (typeof value === 'bigint') return value.toString()
    if (key === 'words' && value instanceof Uint8Array) return undefined
    return value
  }, 2)
}

/**
 * True when the reader has just selected text inside `target`, rather than
 * clicked it. Click-dragging across part of a 66-character public key fires
 * `click` on mouseup, and copying the whole value then would silently
 * overwrite the clipboard with something other than what they highlighted —
 * so the selection wins and the copy is skipped.
 *
 * A selection made elsewhere on the page is collapsed by the mousedown of
 * this very click, so this only ever suppresses a drag that started or ended
 * inside the value itself.
 */
function selectionInside(target: HTMLElement): boolean {
  const selection = window.getSelection?.()
  if (!selection || selection.isCollapsed || selection.toString() === '') return false
  return target.contains(selection.anchorNode) || target.contains(selection.focusNode)
}

export function wireCopyButtons(root: HTMLElement): void {
  root.addEventListener('click', event => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-copy]')
    if (!target) return
    if (selectionInside(target)) return
    void navigator.clipboard?.writeText(target.dataset.copy ?? '')
    const previous = target.getAttribute('data-copied')
    target.setAttribute('data-copied', 'true')
    setTimeout(() => { if (previous === null) target.removeAttribute('data-copied') }, 1200)
  })
}
