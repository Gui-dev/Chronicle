'use client'

import { CreateMemoryWizard } from '@/components/create-memory-wizard'

export default function NewMemoryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text">Nova Memória</h1>
        <p className="mt-2 text-muted">Registre um novo momento na sua timeline</p>
      </div>
      <CreateMemoryWizard />
    </div>
  )
}
