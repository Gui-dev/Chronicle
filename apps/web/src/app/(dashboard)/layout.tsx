import { LazyAudioPlayer } from '@/components/lazy-audio-player'
import { Navbar } from '@/components/navbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50">
        <Navbar />
      </header>
      <main className="flex-1 pb-24">{children}</main>
      <LazyAudioPlayer />
    </div>
  )
}
