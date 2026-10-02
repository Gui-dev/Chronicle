'use client'

import { getQueryClient } from '@/lib/query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={['light', 'dark']}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <ReactQueryDevtools />
        <Toaster
          position="top-right"
          richColors
          toastOptions={{ className: 'bg-card border-card text-text' }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
