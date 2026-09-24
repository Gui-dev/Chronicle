'use client'

import { getQueryClient } from '@/lib/query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools />
      <Toaster
        position="top-right"
        richColors
        toastOptions={{ className: 'bg-card border-card text-text' }}
      />
    </QueryClientProvider>
  )
}
