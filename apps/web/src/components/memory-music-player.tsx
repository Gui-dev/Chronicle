'use client'

import { Pause, Play } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface MemoryMusicPlayerProps {
  track: string
  artist: string
  url: string
  cover?: string | null
}

export function MemoryMusicPlayer({ track, artist, url, cover }: MemoryMusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {})
      } else {
        audioRef.current.pause()
      }
    }
  }, [isPlaying])

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime)
      setDuration(audioRef.current.duration || 0)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number.parseFloat(e.target.value)
    setProgress(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="rounded-xl bg-background p-4">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      >
        <track kind="captions" />
      </audio>

      <div className="flex items-center gap-4">
        {cover && <img src={cover} alt={track} className="h-14 w-14 rounded-lg object-cover" />}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{track}</p>
          <p className="truncate text-xs text-muted">{artist}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-background transition-colors hover:bg-secondary"
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-muted">{formatTime(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={progress}
          onChange={handleSeek}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-card accent-primary"
        />
        <span className="text-xs text-muted">{formatTime(duration)}</span>
      </div>
    </div>
  )
}
