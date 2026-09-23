'use client'

import { useAuth } from '@/hooks/use-auth'
import { signOut } from '@/lib/auth-client'
import { Disc3 } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export function Navbar() {
  const { user, isAuthenticated, invalidateSession } = useAuth()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  const links = [
    { href: '/', label: 'Timeline' },
    { href: '/memories', label: 'Memorias' },
    { href: '/search', label: 'Buscar' },
  ]

  const linkClass = (href: string) =>
    `text-sm font-medium transition-all hover:text-primary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)] ${
      isActive(href) ? 'text-primary drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]' : 'text-text'
    }`

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

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

        <div className="hidden items-center gap-8 md:flex">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass(href)}>
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">{user?.name}</span>
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
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background transition-all hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
