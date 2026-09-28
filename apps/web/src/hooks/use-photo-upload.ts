'use client'

import { useState } from 'react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'
const MAX_ATTEMPTS = 3
const BASE_DELAY_MS = 500

export interface UploadProgress {
  current: number
  total: number
  fileName: string
}

function uploadOne(
  memoryId: string,
  file: File,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_URL}/api/memories/${memoryId}/photos`)
    xhr.withCredentials = true

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total)
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        let message = `Upload falhou (${xhr.status})`
        try {
          const body = JSON.parse(xhr.responseText)
          if (body?.error?.message) message = body.error.message
        } catch {
          // keep the status-only message
        }
        reject(new Error(message))
      }
    }

    xhr.onerror = () => reject(new Error('Erro de rede durante o upload'))
    xhr.ontimeout = () => reject(new Error('Tempo esgotado no upload'))

    const formData = new FormData()
    formData.append('file', file)
    xhr.send(formData)
  })
}

export function usePhotoUpload() {
  const [progress, setProgress] = useState<UploadProgress | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  /**
   * Uploads every photo for a memory, sequentially, retrying each one with
   * exponential backoff. Throws if any file ultimately fails — the caller is
   * responsible for the compensating delete so a memory is never left
   * half-registered.
   */
  const uploadPhotos = async (memoryId: string, files: File[]) => {
    setIsUploading(true)
    setProgress({ current: 0, total: files.length, fileName: files[0]?.name ?? '' })

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        setProgress({ current: index + 1, total: files.length, fileName: file.name })

        let lastError: Error | null = null
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            await uploadOne(memoryId, file, () => {})
            lastError = null
            break
          } catch (error) {
            lastError = error as Error
            if (attempt < MAX_ATTEMPTS) {
              await new Promise((resolve) =>
                setTimeout(resolve, BASE_DELAY_MS * 2 ** (attempt - 1)),
              )
            }
          }
        }

        if (lastError) throw lastError
      }
    } finally {
      setIsUploading(false)
      setProgress(null)
    }
  }

  return { uploadPhotos, progress, isUploading }
}
