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
      {/* tabIndex -1: last-resort programmatic-focus target when a dialog's
          trigger unmounted (e.g. deleted card). Skip-target pattern — not
          tab-reachable, invisible to the accessibility tree. */}
      <main className="flex-1 pb-24" tabIndex={-1}>
        {children}
      </main>
      <LazyAudioPlayer />
    </div>
  )
}
