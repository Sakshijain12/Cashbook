import vision from '@google-cloud/vision'
import { createWorker } from 'tesseract.js'
import sharp from 'sharp'
import fs from 'fs'
import { parseReceipt } from './receipt-parser'

let gcpClient: InstanceType<typeof vision.ImageAnnotatorClient> | undefined
let tesseractWorker: any = null
let workerInitializing = false

async function getTesseractWorker() {
  if (tesseractWorker) return tesseractWorker
  if (workerInitializing) {
    while (workerInitializing) {
      await new Promise(r => setTimeout(r, 100))
    }
    if (tesseractWorker) return tesseractWorker
  }
  workerInitializing = true
  try {
    tesseractWorker = await createWorker(['eng', 'jpn'])
  } finally {
    workerInitializing = false
  }
  return tesseractWorker
}

function hasValidGcpCredentials(): boolean {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!credPath || credPath.includes('your-')) return false
  return fs.existsSync(credPath)
}

export async function scanBill(image: Buffer) {
  // 1. If genuine GCP Vision credentials exist, try Google Cloud Vision first
  if (hasValidGcpCredentials()) {
    try {
      gcpClient ??= new vision.ImageAnnotatorClient()
      const [response] = await gcpClient.batchAnnotateImages(
        { requests: [{ image: { content: image }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }] }] },
        { timeout: 15000 }
      )
      const result = response.responses?.[0]
      const text = result?.fullTextAnnotation?.text ?? ''
      if (text.trim()) {
        return {
          ...parseReceipt(text),
          status: 'extracted' as const,
          provider: 'google-cloud-vision',
        }
      }
    } catch (err: any) {
      console.warn('GCP Vision failed, falling back to local OCR engine:', err?.message || err)
    }
  }

  // 2. Built-in Local OCR Engine (Offline, no cloud account or API key required)
  try {
    // Preprocess image with sharp to maximize contrast and letter clarity for receipts
    const preprocessed = await sharp(image)
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalise()
      .sharpen()
      .png()
      .toBuffer()

    const worker = await getTesseractWorker()
    const { data } = await worker.recognize(preprocessed)
    const text = data?.text ?? ''

    if (text.trim()) {
      const parsed = parseReceipt(text)
      return {
        ...parsed,
        status: 'extracted' as const,
        provider: 'local-tesseract',
      }
    }

    return {
      ...parseReceipt(''),
      status: 'no_text' as const,
      provider: 'local-tesseract',
      warnings: ['No clear text detected on the bill. Please check the values.'],
    }
  } catch (err: any) {
    console.error('Local OCR recognition error:', err)
    return {
      ...parseReceipt(''),
      status: 'unavailable' as const,
      provider: 'local-tesseract',
      warnings: ['Receipt reading was unavailable. Attachment was saved; please enter details manually.'],
    }
  }
}

