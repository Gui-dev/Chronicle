'use client'

import dynamic from 'next/dynamic'

const AudioPlayer = dynamic(() => import('@/components/audio-player').then((m) => m.AudioPlayer))

export function LazyAudioPlayer() {
  return <AudioPlayer />
}
