export function readFragment(hash: string): string {
  if (!hash || hash === '#') return ''
  const raw = hash.slice(1)
  // A hand-edited or shared URL can carry a malformed escape like `#%zz`,
  // which browsers keep literally and decodeURIComponent throws on. Fall
  // back to the raw text: the decoder will explain whatever it turns out to
  // be, and a crash here would take the page down before it rendered.
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function writeFragment(invoice: string): void {
  const url = invoice ? `${location.pathname}#${invoice}` : location.pathname
  history.replaceState(null, '', url)
}
