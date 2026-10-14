// apps/api/src/services/storage.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

let client: S3Client | undefined

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

function isR2Configured(): boolean {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    return false
  }
  // Check if they are dummy placeholders
  if (
    R2_ACCOUNT_ID.includes('your-') ||
    R2_ACCESS_KEY_ID.includes('your-') ||
    R2_SECRET_ACCESS_KEY.includes('your-') ||
    R2_PUBLIC_URL.includes('your-domain')
  ) {
    return false
  }
  return true
}

function storageConfig() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  if (!isR2Configured()) {
    throw Object.assign(new Error('Attachment storage is not configured'), { statusCode: 503 })
  }
  client ??= new S3Client({
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
  })
  return { s3: client, bucket: R2_BUCKET_NAME!, base: R2_PUBLIC_URL!.replace(/\/$/, '') }
}

export async function uploadToR2(
  buffer:    Buffer,
  mimeType:  string,
  prefix =   'bills',
  baseUrl =  'http://localhost:3000'
): Promise<{ url: string; thumbUrl: string }> {
  // If Cloudflare R2 is configured, upload to R2
  if (isR2Configured()) {
    try {
      const { s3, bucket: BUCKET, base: BASE } = storageConfig()
      const id = randomUUID()
      const extensions: Record<string, string> = {
        'application/pdf': 'pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      }
      const ext = extensions[mimeType]
      if (!ext) throw Object.assign(new Error('Unsupported attachment type'), { statusCode: 415 })
      const key = `${prefix}/${id}.${ext}`

      // Upload original
      await s3.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         key,
        Body:        buffer,
        ContentType: mimeType,
      }))

      let thumbUrl = `${BASE}/${key}`

      // Generate thumbnail for images
      if (mimeType.startsWith('image/')) {
        const thumbBuffer = await sharp(buffer)
          .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toBuffer()

        const thumbKey = `${prefix}/${id}_thumb.jpg`
        await s3.send(new PutObjectCommand({
          Bucket:      BUCKET,
          Key:         thumbKey,
          Body:        thumbBuffer,
          ContentType: 'image/jpeg',
        }))

        thumbUrl = `${BASE}/${thumbKey}`
      }

      return { url: `${BASE}/${key}`, thumbUrl }
    } catch (err: any) {
      console.warn('R2 upload failed, falling back to local file storage:', err?.message || err)
    }
  }

  // Local storage: reliably save to disk and serve via /uploads/
  const id = randomUUID()
  const extensions: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const ext = extensions[mimeType] || 'jpg'
  const targetDir = path.join(UPLOADS_DIR, prefix)
  await fs.promises.mkdir(targetDir, { recursive: true })

  const filename = `${id}.${ext}`
  const filePath = path.join(targetDir, filename)
  await fs.promises.writeFile(filePath, buffer)

  const cleanBase = baseUrl.replace(/\/$/, '')
  let thumbUrl = `${cleanBase}/uploads/${prefix}/${filename}`

  if (mimeType.startsWith('image/')) {
    const thumbBuffer = await sharp(buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer()

    const thumbFilename = `${id}_thumb.jpg`
    const thumbPath = path.join(targetDir, thumbFilename)
    await fs.promises.writeFile(thumbPath, thumbBuffer)
    thumbUrl = `${cleanBase}/uploads/${prefix}/${thumbFilename}`
  }

  return {
    url: `${cleanBase}/uploads/${prefix}/${filename}`,
    thumbUrl,
  }
}

