'use client'

import type { Memory } from '@/hooks/use-memories'
import { Music, Pause, Play } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface MemoryCardProps {
  memory: Memory
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Hoje'
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return `${diffDays} dias atrás`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} atrás`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} ${months === 1 ? 'mês' : 'meses'} atrás`
  }
  const years = Math.floor(diffDays / 365)
  return `${years} ${years === 1 ? 'ano' : 'anos'} atrás`
}

export function MemoryCard({ memory }: MemoryCardProps) {
  const formattedDate = new Date(memory.memoryDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const relativeDate = formatRelativeDate(memory.memoryDate)

  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
        {formattedDate}
      </span>
      <span className="font-mono text-xs text-muted">{relativeDate}</span>
    </div>
  )
}

export function MemoryCardFull({ memory }: MemoryCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [narrativeOpen, setNarrativeOpen] = useState(false)

  const formattedDate = new Date(memory.memoryDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const relativeDate = formatRelativeDate(memory.memoryDate)

  return (
    <article className="relative group">
      <div className="absolute -left-6 sm:-left-[35px] top-6 h-5 w-5 rounded-full border-4 border-background bg-primary shadow-[0_0_8px_rgba(240,192,64,0.5)] z-10" />

      <div className="mb-3 flex items-center gap-3">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
          {formattedDate}
        </span>
        <span className="font-mono text-xs text-muted">{relativeDate}</span>
      </div>

      <Link href={`/memories/${memory.id}`}>
        <div className="space-y-6 rounded-3xl border border-card/80 bg-card p-6 shadow-lg transition-all duration-300 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(240,192,64,0.1)] sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-text group-hover:text-primary transition-colors">
                &ldquo;{memory.title}&rdquo;
              </h2>
              {memory.content && (
                <p className="mt-1 font-serif text-sm italic text-muted line-clamp-2">
                  &ldquo;{memory.content}&rdquo;
                </p>
              )}
            </div>

            {memory.musicTrack && (
              <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-background p-3 transition-all hover:bg-card group/music shadow-[0_0_8px_rgba(240,192,64,0.15)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary transition-transform group-hover/music:scale-105">
                  <Music className="h-5 w-5" />
                </div>
                <div className="text-left pr-2">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                    Trilha Sonora
                  </span>
                  <span className="block text-xs font-bold text-text">
                    {memory.musicArtist ? `${memory.musicArtist} — ` : ''}
                    {memory.musicTrack}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setIsPlaying(!isPlaying)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4 fill-background" />
                  ) : (
                    <Play className="ml-0.5 h-4 w-4 fill-background" />
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
            {memory.weatherTemp && (
              <span className="flex items-center gap-1.5 rounded-xl border border-card bg-background px-3 py-1.5 text-amber-300">
                {memory.weatherIcon || '🌤️'} {memory.weatherTemp}°C
                {memory.weatherDesc ? ` ${memory.weatherDesc}` : ''}
              </span>
            )}
            {memory.locationName && (
              <span className="flex items-center gap-1.5 rounded-xl border border-card bg-background px-3 py-1.5 text-gray-300">
                📍 {memory.locationName}
              </span>
            )}
          </div>

          {memory.aiNarrative && (
            <div className="border-t border-card/60 pt-4">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  setNarrativeOpen(!narrativeOpen)
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-background/60 p-4 text-left transition-all hover:bg-background"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/20 text-primary">
                    ✨
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-text">
                      Memória Narrativa Gerada por IA
                    </span>
                    <span className="text-[11px] text-muted">
                      Transforme o relato bruto em um conto cinematográfico
                    </span>
                  </div>
                </div>
                <span className="flex items-center gap-1 font-mono text-xs font-bold text-primary">
                  <span>{narrativeOpen ? 'Recolher' : 'Expandir'}</span>
                  <span className={`transition-transform ${narrativeOpen ? 'rotate-180' : ''}`}>
                    ▾
                  </span>
                </span>
              </button>

              {narrativeOpen && (
                <div className="mt-4 rounded-2xl border border-card bg-background/40 p-5 font-serif text-sm leading-relaxed italic text-gray-300">
                  <p>{memory.aiNarrative}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Link>
    </article>
  )
}
