'use client'

import { useAuth } from '@/hooks/use-auth'
import { signOut } from '@/lib/auth-client'
import { Disc3 } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/', label: 'Timeline' },
  { href: '/memories', label: 'Memórias' },
  { href: '/search', label: 'Buscar' },
]

export function Navbar() {
  const pathname = usePathname()
  const { user, isAuthenticated } = useAuth()

  return (
    <nav className="sticky top-0 z-50 border-b border-card bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Disc3 className="h-8 w-8 animate-spin text-primary drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]" />
          <span className="text-xl font-bold text-text">Chronicle</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === link.href ? 'text-primary' : 'text-muted'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted">{user?.name}</span>
              <button
                type="button"
                onClick={() => signOut()}
                className="text-sm text-muted transition-colors hover:text-text"
              >
                Sair
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-secondary"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
