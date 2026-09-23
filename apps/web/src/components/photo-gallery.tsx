'use client'

import { X } from 'lucide-react'
import { useState } from 'react'

interface Photo {
  id: string
  url: string
  filename: string | null
}

interface PhotoGalleryProps {
  photos: Photo[]
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-text">Fotos</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => setLightboxIndex(index)}
            className="group relative cursor-pointer overflow-hidden rounded-lg aspect-square"
          >
            <img
              src={photo.url}
              alt={photo.filename || 'Foto da memória'}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <button
          type="button"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          onClick={() => setLightboxIndex(null)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightboxIndex(null)
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 top-4 cursor-pointer rounded-full bg-background/80 p-2 text-text"
          >
            <X className="h-6 w-6" />
          </button>

          <img
            src={photos[lightboxIndex].url}
            alt={photos[lightboxIndex].filename || 'Foto da memória'}
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <div className="absolute bottom-4 flex gap-2">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setLightboxIndex(index)
                  }}
                  className={`h-2 w-2 rounded-full ${
                    index === lightboxIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          )}
        </button>
      )}
    </div>
  )
}
