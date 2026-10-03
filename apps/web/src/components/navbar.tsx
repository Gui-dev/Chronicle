'use client'

import { SearchDropdown } from '@/components/search-dropdown'
import { useAuth } from '@/hooks/use-auth'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { signOut } from '@/lib/auth-client'
import { getInitials } from '@/lib/get-initials'
import { Button, Input } from '@chronicle/ui'
import { Check, Disc3, History, Library, LogOut, Plus, Search, User } from 'lucide-react'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export function Navbar() {
  const { user, isAuthenticated, isLoading, invalidateSession } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebouncedValue(searchQuery, 300)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (user?.image) setAvatarFailed(false)
  }, [user?.image])

  useEffect(() => {
    if (!menuOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Home' &&
        event.key !== 'End'
      ) {
        return
      }
      event.preventDefault()
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"], [role="menuitemradio"]',
        ) ?? [],
      )
      if (items.length === 0) return
      const current = items.indexOf(document.activeElement as HTMLElement)
      let next: number
      if (event.key === 'Home') next = 0
      else if (event.key === 'End') next = items.length - 1
      else if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length
      else next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
      items[next]?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  if (isLoading) {
    return (
      <nav className="relative z-50 border-b border-card bg-background/80 backdrop-blur-sm">
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
    'flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-text transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50'
  const menuIconClass = 'h-4 w-4 shrink-0'

  const themeOptions = [
    { value: 'system', label: 'Sistema', testId: 'menu-theme-system' },
    { value: 'dark', label: 'Escuro', testId: 'menu-theme-dark' },
    { value: 'light', label: 'Claro', testId: 'menu-theme-light' },
    { value: 'purple', label: 'Roxo', testId: 'menu-theme-purple' },
  ] as const

  return (
    <>
      <nav className="relative z-50 border-b border-card bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" onClick={() => setMenuOpen(false)}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-primary/50 bg-primary/10">
              <Disc3 className="h-4 w-4 animate-[spin_4s_linear_infinite] text-primary drop-shadow-[0_0_8px_rgba(var(--glow-rgb),0.8)]" />
            </div>
            <span className="text-xl font-bold text-text">Chronicle</span>
          </Link>

          <div className="flex items-center gap-4 ">
            <div className="relative flex-1 max-w-xl sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
              <label htmlFor="navbar-search" className="sr-only">
                Buscar memórias
              </label>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  id="navbar-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onFocus={() => {
                    setMenuOpen(false)
                    setSearchOpen(true)
                  }}
                  onBlur={(e) => {
                    const relatedTarget = e.relatedTarget as HTMLElement | null
                    if (relatedTarget?.closest('[data-testid="search-dropdown"]')) return
                    setTimeout(() => setSearchOpen(false), 500)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && searchQuery.trim()) {
                      event.preventDefault()
                      setSearchOpen(false)
                      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`
                    }
                  }}
                  placeholder="Buscar: #tag @pessoa ano:2026 local:praia"
                  data-testid="navbar-search-input"
                  className="w-full h-10 rounded-lg border bg-background pl-10 pr-4 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  role="combobox"
                  aria-expanded={searchOpen}
                  aria-controls="search-dropdown"
                  aria-autocomplete="list"
                />
                <SearchDropdown
                  debouncedQuery={debouncedQuery}
                  isOpen={searchOpen}
                  onClose={() => setSearchOpen(false)}
                />
              </div>
            </div>

            {isAuthenticated && (
              <Link href="/memories/new" className="hidden sm:block" data-testid="nav-nova">
                <Button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background transition-all hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(var(--glow-rgb),0.8)]">
                  <Plus className="h-4 w-4" />
                  Nova Memória
                </Button>
              </Link>
            )}

            {isAuthenticated ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-primary/30 transition-all hover:border-primary hover:shadow-[0_0_8px_rgba(var(--glow-rgb),0.4)]"
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
                    ref={menuRef}
                    aria-label="Menu do usuário"
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-card bg-card py-1 shadow-lg"
                  >
                    <Link
                      href="/my-memories"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className={menuItemClass}
                      data-testid="menu-my-memories"
                    >
                      <Library className={menuIconClass} />
                      Minhas Memórias
                    </Link>
                    <Link
                      href="/retrospectivas"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className={menuItemClass}
                      data-testid="menu-retrospectivas"
                    >
                      <History className={menuIconClass} />
                      Retrospectivas
                    </Link>
                    <Link
                      href="/profile"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className={menuItemClass}
                      data-testid="menu-profile"
                    >
                      <User className={menuIconClass} />
                      Perfil
                    </Link>
                    <Link
                      href="/memories/new"
                      role="menuitem"
                      onClick={() => setMenuOpen(false)}
                      className={menuItemClass}
                      data-testid="menu-nova"
                    >
                      <Plus className={menuIconClass} />
                      Nova Memória
                    </Link>
                    <div className="my-1 h-px bg-border" aria-hidden="true" />
                    {/* biome-ignore lint/a11y/useSemanticElements: fieldset groups form controls; this groups menu theme choices */}
                    <div role="group" aria-label="Tema">
                      <span className="block px-4 pt-1 pb-1 text-xs text-muted" aria-hidden="true">
                        Tema
                      </span>
                      {themeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={mounted ? theme === option.value : undefined}
                          aria-label={`Tema: ${option.label}`}
                          onClick={() => {
                            setTheme(option.value)
                            setMenuOpen(false)
                            triggerRef.current?.focus()
                          }}
                          className={menuItemClass}
                          data-testid={option.testId}
                        >
                          <span className={`${menuIconClass} grid place-items-center`}>
                            {mounted && theme === option.value ? (
                              <Check className="h-4 w-4" />
                            ) : null}
                          </span>
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <div className="my-1 h-px bg-border" aria-hidden="true" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className={menuItemClass}
                      data-testid="menu-sair"
                    >
                      <LogOut className={menuIconClass} />
                      {signingOut ? 'Saindo...' : 'Sair'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                prefetch={false}
                className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-background transition-all hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(var(--glow-rgb),0.8)] sm:px-4"
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
