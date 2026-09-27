'use client'

import { cn } from '@chronicle/ui'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Photo {
  id: string
  url: string
  filename: string | null
  width: number | null
  height: number | null
}

interface PhotoGalleryProps {
  photos: Photo[]
  /** Section heading. Pass `null` to hide it, e.g. when embedded in the memory card. */
  heading?: string | null
  /** Extra classes merged into the thumbnail grid, to override the column layout. */
  className?: string
  /** Extra classes merged into each thumbnail, to override aspect ratio / rounding. */
  itemClassName?: string
  /** `sizes` hint for the thumbnail images, so the optimizer fetches the right width. */
  sizes?: string
}

export function PhotoGallery({
  photos,
  heading = 'Fotos',
  className,
  itemClassName,
  sizes = '(max-width: 640px) 50vw, (max-width: 768px) 33vw, 176px',
}: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const restoreFocusRef = useRef(false)
  const multiple = photos.length > 1
  const current = lightboxIndex ?? 0

  const openLightbox = useCallback((index: number, trigger: HTMLElement) => {
    triggerRef.current = trigger
    setLightboxIndex(index)
  }, [])

  const closeLightbox = useCallback(() => {
    restoreFocusRef.current = true
    setLightboxIndex(null)
  }, [])

  // While the dialog is modal the rest of the page is inert, so focus can only
  // be restored once it has been removed from the DOM — hence a post-render
  // effect rather than focusing inside closeLightbox.
  useEffect(() => {
    if (lightboxIndex !== null || !restoreFocusRef.current) return
    restoreFocusRef.current = false
    triggerRef.current?.focus()
  }, [lightboxIndex])

  const step = useCallback(
    (direction: 1 | -1) => {
      setLightboxIndex((current) =>
        current === null ? current : (current + direction + photos.length) % photos.length,
      )
    },
    [photos.length],
  )

  // showModal() puts the dialog in the top layer, makes the rest of the page
  // inert, and handles Escape natively — none of which the `open` attribute does.
  useEffect(() => {
    if (lightboxIndex === null) return
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [lightboxIndex])

  useEffect(() => {
    if (lightboxIndex === null) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!multiple) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        step(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        step(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, multiple, step])

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-card py-12">
        <p className="text-muted">Nenhuma foto ainda</p>
      </div>
    )
  }

  return (
    <div>
      {heading && <h2 className="mb-4 text-lg font-semibold text-text">{heading}</h2>}

      <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4', className)}>
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            onClick={(event) => openLightbox(index, event.currentTarget)}
            aria-label={`Abrir foto ${index + 1} de ${photos.length}`}
            className={cn(
              'group relative cursor-pointer overflow-hidden rounded-lg aspect-square',
              itemClassName,
            )}
          >
            <Image
              src={photo.url}
              alt={photo.filename || 'Foto da memória'}
              fill
              sizes={sizes}
              className="object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <dialog
          ref={dialogRef}
          aria-label="Visualizar foto"
          aria-modal="true"
          data-testid="lightbox"
          onClose={closeLightbox}
          // Only a click on the dialog surface itself dismisses it, so the new
          // arrow buttons and the dots don't bubble up and close the lightbox.
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLightbox()
          }}
          // Arrows are handled by the window listener above, not here: this
          // handler would double-advance when the event bubbles up to window.
          onKeyDown={(event) => {
            if (event.key === 'Escape' || event.key === 'Enter') closeLightbox()
          }}
          className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none flex-col items-center justify-center border-0 bg-background/90 p-0 backdrop-blur-sm open:flex"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={closeLightbox}
            className="absolute right-4 top-4 cursor-pointer rounded-full bg-background/80 p-2 text-text"
          >
            <X className="h-6 w-6" />
          </button>

          {multiple && (
            <>
              <button
                type="button"
                data-testid="lightbox-prev"
                aria-label="Foto anterior"
                onClick={() => step(-1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-background/80 p-2 text-text transition-colors hover:text-primary"
              >
                <ChevronLeft className="h-8 w-8" />
              </button>
              <button
                type="button"
                data-testid="lightbox-next"
                aria-label="Próxima foto"
                onClick={() => step(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-background/80 p-2 text-text transition-colors hover:text-primary"
              >
                <ChevronRight className="h-8 w-8" />
              </button>
            </>
          )}

          <Image
            src={photos[current].url}
            alt={photos[current].filename || 'Foto da memória'}
            width={photos[current].width ?? 1200}
            height={photos[current].height ?? 800}
            sizes="90vw"
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
          />

          {multiple && (
            <div className="absolute bottom-4 flex items-center gap-4">
              <div className="flex gap-2">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    aria-label={`Ir para foto ${index + 1}`}
                    aria-current={index === current}
                    onClick={() => setLightboxIndex(index)}
                    className={`h-2 w-2 rounded-full ${
                      index === current ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <span data-testid="lightbox-counter" className="font-mono text-xs text-muted">
                {current + 1} / {photos.length}
              </span>
            </div>
          )}
        </dialog>
      )}
    </div>
  )
}
