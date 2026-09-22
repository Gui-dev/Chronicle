'use client'

import type { Memory } from '@/hooks/use-memories'
import { Button } from '@chronicle/ui'
import { Calendar, Cloud, MapPin, Pause, Play } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface MemoryCardProps {
  memory: Memory
}

export function MemoryCard({ memory }: MemoryCardProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  const formattedDate = new Date(memory.memoryDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="group rounded-xl border-2 border-card bg-card p-6 transition-all hover:border-primary/30 hover:shadow-[0_0_20px_rgba(240,192,64,0.1)]">
      <Link href={`/memories/${memory.id}`} className="block">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text group-hover:text-primary">
              {memory.title}
            </h3>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
            </div>
          </div>
          {memory.weatherIcon && (
            <div className="flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-sm text-primary">
              <Cloud className="h-4 w-4" />
              <span>{memory.weatherTemp}°</span>
            </div>
          )}
        </div>

        {memory.content && <p className="mb-4 line-clamp-3 text-sm text-muted">{memory.content}</p>}

        {memory.locationName && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted">
            <MapPin className="h-4 w-4" />
            <span>{memory.locationName}</span>
          </div>
        )}
      </Link>

      {memory.musicTrack && (
        <div className="flex items-center gap-3 rounded-lg bg-background p-3">
          {memory.musicCover && (
            <img
              src={memory.musicCover}
              alt={memory.musicTrack}
              className="h-12 w-12 rounded-lg object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-text">{memory.musicTrack}</p>
            <p className="truncate text-xs text-muted">{memory.musicArtist}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-primary hover:text-primary/80"
            onClick={(e) => {
              e.preventDefault()
              setIsPlaying(!isPlaying)
            }}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
        </div>
      )}
    </div>
  )
}
