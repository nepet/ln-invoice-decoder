import { classify, normaliseInput } from '../classify'
import { decodeInvoice } from '../decode/invoice'
import type { DecodedInvoice } from '../domain/types'
import { EXAMPLE_INVOICE } from '../examples'
import { readFragment, writeFragment } from './fragment'
import { expiryText, renderInvoice } from './render'
import { wireCopyButtons } from './copy'
import { scanFile, startCamera } from './qr'
import './style.css'

// One countdown for the page, held at module scope so a second mount() cannot
// leave the first one's timer running.
let countdown: ReturnType<typeof setInterval> | null = null
const stopCountdown = () => {
  if (countdown !== null) clearInterval(countdown)
  countdown = null
}

export function mount(root: HTMLElement): void {
  root.replaceChildren()

  const input = document.createElement('textarea')
  input.placeholder = 'Paste a BOLT11 invoice'
  input.spellcheck = false

  const example = document.createElement('button')
  example.dataset.example = ''
  example.textContent = 'Load example'

  const scanButton = document.createElement('button')
  scanButton.dataset.scanQr = ''
  scanButton.textContent = 'Scan QR'

  const video = document.createElement('video')
  video.hidden = true
  video.setAttribute('playsinline', '')
  video.setAttribute('muted', '')

  const output = document.createElement('div')
  root.append(input, example, scanButton, video, output)

  // The invoice currently on screen, kept decoded so the countdown below can
  // recompute the expiry without decoding or rendering anything again.
  let shown: DecodedInvoice | null = null

  const show = (raw: string, { updateFragment = true } = {}) => {
    const invoice = normaliseInput(raw)
    if (updateFragment) writeFragment(invoice)
    const kind = classify(invoice)
    if (kind.kind === 'empty') {
      shown = null
      output.replaceChildren(emptyState())
      return
    }
    if (kind.kind !== 'bolt11' && kind.message) {
      shown = null
      const p = document.createElement('p')
      p.dataset.notInvoice = ''
      p.textContent = kind.message
      output.replaceChildren(p)
      return
    }
    shown = decodeInvoice(invoice)
    output.replaceChildren(renderInvoice(shown, new Date()))
  }

  input.addEventListener('input', () => show(input.value))
  example.addEventListener('click', () => { input.value = EXAMPLE_INVOICE; show(EXAMPLE_INVOICE) })
  window.addEventListener('hashchange', () => { input.value = readFragment(location.hash); show(input.value, { updateFragment: false }) })

  // Camera panel: toggled by the Scan QR button. `stopCamera` is only set
  // while the panel is open, so clicking again (or a successful scan) closes
  // it and — critically — stops every media track so the camera light goes
  // out.
  let stopCamera: (() => void) | null = null
  const closeCamera = () => {
    stopCamera?.()
    stopCamera = null
    video.hidden = true
    video.srcObject = null
  }
  scanButton.addEventListener('click', () => {
    if (stopCamera) { closeCamera(); return }
    video.hidden = false
    stopCamera = startCamera(video, invoice => {
      input.value = invoice
      show(invoice)
      closeCamera()
    })
  })

  // Drop a QR screenshot onto the textarea instead of retyping the invoice.
  // preventDefault on dragover is required for drop to fire at all; on drop
  // it stops the browser from navigating to the dropped file. scanFile never
  // throws for a non-image file or an image with no QR code — both resolve
  // to null and are silently ignored here.
  input.addEventListener('dragover', event => event.preventDefault())
  input.addEventListener('drop', event => {
    event.preventDefault()
    const file = event.dataTransfer?.files[0]
    if (!file) return
    scanFile(file)
      .then(invoice => { if (invoice) { input.value = invoice; show(invoice) } })
      .catch(() => {})
  })

  // Keep the expiry countdown live by rewriting exactly one text node. It must
  // not re-render: that would swap every <details> expander for a fresh closed
  // one and wipe the reader's selection, once a second. Stops itself once
  // `root` is no longer attached to the document, so it never outlives the page.
  stopCountdown()
  countdown = setInterval(() => {
    if (!root.isConnected) {
      stopCountdown()
      return
    }
    const node = output.querySelector<HTMLElement>('[data-expiry]')
    if (!shown || !node) return
    const text = expiryText(shown, new Date())
    if (node.textContent === text) return
    node.textContent = text
    node.dataset.copy = text
  }, 1000)

  const initial = readFragment(location.hash)
  input.value = initial
  show(initial, { updateFragment: false })

  wireCopyButtons(root)
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
