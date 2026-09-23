import { AudioPlayer } from '@/components/audio-player'
import { AuthGuard } from '@/components/auth-guard'
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
      <AudioPlayer />
    </div>
  )
}
