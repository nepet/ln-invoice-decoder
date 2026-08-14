import { classify, normaliseInput } from '../classify'
import { decodeInvoice } from '../decode/invoice'
import { EXAMPLE_INVOICE } from '../examples'
import { readFragment, writeFragment } from './fragment'
import { renderInvoice } from './render'
import './style.css'

export function mount(root: HTMLElement): void {
  root.replaceChildren()

  const input = document.createElement('textarea')
  input.placeholder = 'Paste a BOLT11 invoice'
  input.spellcheck = false

  const example = document.createElement('button')
  example.dataset.example = ''
  example.textContent = 'Load example'

  const output = document.createElement('div')
  root.append(input, example, output)

  // Tracks the currently-decoded invoice so the countdown interval below can
  // re-render the expiry without touching the textarea or the fragment.
  let currentInvoice = ''

  const show = (raw: string, { updateFragment = true } = {}) => {
    const invoice = normaliseInput(raw)
    if (updateFragment) writeFragment(invoice)
    const kind = classify(invoice)
    if (kind.kind === 'empty') {
      currentInvoice = ''
      output.replaceChildren(emptyState())
      return
    }
    if (kind.kind !== 'bolt11' && kind.message) {
      currentInvoice = ''
      const p = document.createElement('p')
      p.dataset.notInvoice = ''
      p.textContent = kind.message
      output.replaceChildren(p)
      return
    }
    currentInvoice = invoice
    output.replaceChildren(renderInvoice(decodeInvoice(invoice), new Date()))
  }

  input.addEventListener('input', () => show(input.value))
  example.addEventListener('click', () => { input.value = EXAMPLE_INVOICE; show(EXAMPLE_INVOICE) })
  window.addEventListener('hashchange', () => { input.value = readFragment(location.hash); show(input.value, { updateFragment: false }) })

  // Re-render once a second so the expiry countdown stays live. Only fires
  // while there is a decoded invoice to show, never touches the input, and
  // never rewrites the fragment (updateFragment: false) — otherwise a tick
  // would compete with the user's own edits. Stops itself once `root` is no
  // longer attached to the document, so it never outlives the page.
  const interval = setInterval(() => {
    if (!root.isConnected) {
      clearInterval(interval)
      return
    }
    if (currentInvoice) show(currentInvoice, { updateFragment: false })
  }, 1000)

  const initial = readFragment(location.hash)
  input.value = initial
  show(initial, { updateFragment: false })
}

function emptyState(): HTMLElement {
  const p = document.createElement('p')
  p.dataset.empty = ''
  p.textContent = 'Decodes a BOLT11 invoice in your browser. Nothing is sent anywhere.'
  return p
}

if (typeof document !== 'undefined' && document.getElementById('app')) {
  mount(document.getElementById('app')!)
}
