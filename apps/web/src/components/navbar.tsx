'use client'

import { useAuth } from '@/hooks/use-auth'
import { signOut } from '@/lib/auth-client'
import { Disc3, Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Navbar() {
  const { user, isAuthenticated, isLoading, invalidateSession } = useAuth()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  if (isLoading) {
    return (
      <nav className="sticky top-0 z-50 border-b border-card bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-lg border-2 border-primary/50 bg-primary/10" />
          </div>
          <div className="h-8 w-24 animate-pulse rounded-lg bg-card" />
        </div>
      </nav>
    )
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      await invalidateSession()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-card bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-primary/50 bg-primary/10">
            <Disc3 className="h-4 w-4 animate-[spin_4s_linear_infinite] text-primary drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]" />
          </div>
          <span className="text-xl font-bold text-text">Chronicle</span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push('/search')}
            className="cursor-pointer text-muted transition-all hover:text-primary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]"
            aria-label="Buscar"
            data-testid="search-button"
          >
            <Search className="h-5 w-5" />
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="max-w-[100px] truncate text-sm text-muted sm:max-w-[200px]">
                {user?.name}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="cursor-pointer text-sm text-muted transition-all hover:text-primary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]"
              >
                {signingOut ? 'Saindo...' : 'Sair'}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background transition-all hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)] sm:px-4"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
