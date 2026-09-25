'use client'

import { ImagePlus, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface StepPhotosProps {
  photos: File[]
  onPhotosChange: (photos: File[]) => void
}

function PhotoPreview({ photo }: { photo: File }) {
  const [objectUrl, setObjectUrl] = useState<string>()

  useEffect(() => {
    const url = URL.createObjectURL(photo)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  if (!objectUrl) return null

  return <img src={objectUrl} alt={photo.name} className="h-full w-full object-cover" />
}

export function StepPhotos({ photos, onPhotosChange }: StepPhotosProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const newPhotos = Array.from(files).filter((file) => file.type.startsWith('image/'))
      onPhotosChange([...photos, ...newPhotos])
    },
    [photos, onPhotosChange],
  )

  const removePhoto = useCallback(
    (index: number) => {
      onPhotosChange(photos.filter((_, i) => i !== index))
    },
    [photos, onPhotosChange],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (e.dataTransfer.files) {
        addFiles(e.dataTransfer.files)
      }
    },
    [addFiles],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        addFiles(e.target.files)
      }
    },
    [addFiles],
  )

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Fotos</h2>
        <p className="mt-1 text-sm text-muted">
          Adicione fotos para tornar esta memória mais especial
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={handleKeyDown}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all ${
          isDragOver ? 'border-primary bg-primary/10' : 'border-card hover:border-primary/30'
        }`}
      >
        <ImagePlus className="mb-4 h-12 w-12 text-muted" />
        <p className="text-sm font-medium text-text">
          Arraste fotos aqui ou clique para selecionar
        </p>
        <p className="mt-1 text-xs text-muted">JPG, PNG, WebP</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, index) => (
            <div
              key={`${photo.name}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-lg"
            >
              <PhotoPreview photo={photo} />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute right-2 top-2 cursor-pointer rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-4 w-4 text-text" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
