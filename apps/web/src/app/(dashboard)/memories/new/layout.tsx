'use client'

import { RequireAuth } from '@/components/require-auth'
import { WizardProvider } from '@/components/wizard-provider'
import { useEffect } from 'react'

export default function NewMemoryLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Workaround for Next.js 16+ performance.measure negative timestamp bug
  // See: https://github.com/vercel/next.js/issues/...
  useEffect(() => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      try {
        performance.clearMarks()
        performance.clearMeasures()
      } catch {
        // Ignore errors in performance API
      }
    }
  }, [])

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
