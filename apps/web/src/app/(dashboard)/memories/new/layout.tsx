'use client'

import { RequireAuth } from '@/components/require-auth'
import { WizardProvider } from '@/components/wizard-provider'

export default function NewMemoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireAuth>
      <WizardProvider>
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text">Nova Memória</h1>
            <p className="mt-2 text-muted">Registre um novo momento na sua timeline</p>
          </div>
          {children}
        </div>
      </WizardProvider>
    </RequireAuth>
  )
}
