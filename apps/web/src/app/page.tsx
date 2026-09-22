import { Navbar } from '@/components/navbar'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <h1 className="text-3xl font-bold text-text">Sua Timeline</h1>
          <p className="mt-2 text-muted">Suas memórias, sua trilha sonora</p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-card bg-card p-6">
              <p className="text-muted">Nenhuma memória ainda</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
