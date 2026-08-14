import jsQR from 'jsqr'
import { normaliseInput } from '../classify'

export function decodeImageData(image: ImageData): string | null {
  const result = jsQR(image.data, image.width, image.height)
  return result ? normaliseInput(result.data) : null
}

export async function scanFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  return decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
}

export function startCamera(video: HTMLVideoElement, onResult: (invoice: string) => void): () => void {
  let stream: MediaStream | null = null
  let stopped = false
  let frame = 0
  const canvas = document.createElement('canvas')

  void navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(s => {
    if (stopped) { s.getTracks().forEach(t => t.stop()); return }
    stream = s
    video.srcObject = s
    // play() rejects under real autoplay policies, and jsdom returns
    // undefined rather than a promise — Promise.resolve handles both
    // without throwing.
    void Promise.resolve(video.play()).catch(() => {})
    const tick = () => {
      if (stopped) return
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)
        const found = decodeImageData(ctx.getImageData(0, 0, canvas.width, canvas.height))
        if (found) { onResult(found); return }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
  }).catch(() => {
    // Denied permission, no camera present, insecure context, etc. Nothing
    // to recover: the panel just never shows a picture. Without this catch,
    // a rejection here becomes an unhandled promise rejection — swallow it
    // so the tool never throws at the user for something as ordinary as
    // saying no to a camera prompt.
  })

  return () => {
    stopped = true
    cancelAnimationFrame(frame)
    stream?.getTracks().forEach(t => t.stop())
  }
}
