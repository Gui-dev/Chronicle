import { AuthGuard } from '@/components/auth-guard'
import { LazyAudioPlayer } from '@/components/lazy-audio-player'
import { Navbar } from '@/components/navbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <AuthGuard>
        <main className="flex-1 pb-24">{children}</main>
      </AuthGuard>
      <LazyAudioPlayer />
    </div>
  )
}
