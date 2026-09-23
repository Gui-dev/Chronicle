'use client'

import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Track {
  id: string
  title: string
  artist: string
  url: string
  cover?: string
}

export function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, _setCurrentTrack] = useState<Track | null>(null)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
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

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = Number.parseFloat(e.target.value)
    setVolume(vol)
    if (audioRef.current) {
      audioRef.current.volume = vol
    }
    setIsMuted(vol === 0)
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
    }
    setIsMuted(!isMuted)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!currentTrack) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-card bg-background/95 backdrop-blur-sm">
      <audio
        ref={audioRef}
        src={currentTrack.url}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
      >
        <track kind="captions" />
      </audio>

      <div className="mx-auto flex h-24 max-w-7xl items-center gap-4 px-4">
        {/* Track Info */}
        <div className="flex w-64 items-center gap-3">
          {currentTrack.cover && (
            <img
              src={currentTrack.cover}
              alt={currentTrack.title}
              className="h-12 w-12 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{currentTrack.title}</p>
            <p className="truncate text-xs text-muted">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="cursor-pointer text-muted transition-colors hover:text-text"
            >
              <SkipBack className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-background transition-colors hover:bg-secondary"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </button>

            <button
              type="button"
              className="cursor-pointer text-muted transition-colors hover:text-text"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          <div className="flex w-full max-w-md items-center gap-2">
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

        {/* Volume */}
        <div className="flex w-32 items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="cursor-pointer text-muted transition-colors hover:text-text"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-card accent-primary"
          />
        </div>
      </div>
    </div>
  )
}
