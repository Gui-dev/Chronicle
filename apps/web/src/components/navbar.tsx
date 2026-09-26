'use client'

import { useAuth } from '@/hooks/use-auth'
import { signOut } from '@/lib/auth-client'
import { Disc3, Search } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return ((email ?? '').trim()[0] ?? '?').toUpperCase()
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function Navbar() {
  const { user, isAuthenticated, isLoading, invalidateSession } = useAuth()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (user?.image) setAvatarFailed(false)
  }, [user?.image])

  useEffect(() => {
    if (!menuOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

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
      setMenuOpen(false)
    }
  }

  const menuItemClass =
    'block w-full px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50'

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-card bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-primary/50 bg-primary/10">
              <Disc3 className="h-4 w-4 animate-[spin_4s_linear_infinite] text-primary drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]" />
            </div>
            <span className="text-xl font-bold text-text">Chronicle</span>
          </Link>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                router.push('/search')
              }}
              className="cursor-pointer text-muted transition-all hover:text-primary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]"
              aria-label="Buscar"
              data-testid="search-button"
            >
              <Search className="h-5 w-5" />
            </button>

            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-primary/30 transition-all hover:border-primary hover:shadow-[0_0_8px_rgba(240,192,64,0.4)]"
                  aria-label="Menu do usuário"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  data-testid="user-menu-toggle"
                  ref={triggerRef}
                >
                  {user?.image && !avatarFailed ? (
                    <Image
                      src={user.image}
                      alt={user.name || 'Avatar'}
                      width={32}
                      height={32}
                      sizes="32px"
                      className="h-8 w-8 object-cover"
                      onError={() => setAvatarFailed(true)}
                    />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                      {getInitials(user?.name, user?.email)}
                    </span>
                  )}
                </button>

                {menuOpen && (
                  <div
                    aria-label="Menu do usuário"
                    className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-card bg-card py-1 shadow-lg"
                  >
                    <Link
                      href="/my-memories"
                      onClick={() => setMenuOpen(false)}
                      className={menuItemClass}
                      data-testid="menu-my-memories"
                    >
                      Minhas Memórias
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className={menuItemClass}
                      data-testid="menu-profile"
                    >
                      Perfil
                    </Link>
                    <Link
                      href="/memories/new"
                      onClick={() => setMenuOpen(false)}
                      className={menuItemClass}
                      data-testid="menu-nova"
                    >
                      Nova Memória
                    </Link>
                    <div className="my-1 h-px bg-border" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className={menuItemClass}
                      data-testid="menu-sair"
                    >
                      {signingOut ? 'Saindo...' : 'Sair'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                prefetch={false}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background transition-all hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)] sm:px-4"
              >
                Entrar
              </Link>
            )}
          </div>
        </div>
      </nav>

      {isAuthenticated && menuOpen && (
        <button
          type="button"
          tabIndex={-1}
          className="fixed inset-0 z-40 cursor-default"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu do usuário"
          data-testid="user-menu-overlay"
        />
      )}
    </>
  )
}
