export function readFragment(hash: string): string {
  if (!hash || hash === '#') return ''
  return decodeURIComponent(hash.slice(1))
}

export function writeFragment(invoice: string): void {
  const url = invoice ? `${location.pathname}#${invoice}` : location.pathname
  history.replaceState(null, '', url)
}
