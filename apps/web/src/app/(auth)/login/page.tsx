'use client'

import { signIn } from '@/lib/auth-client'
import { Button, Card, Input, Label } from '@chronicle/ui'
import { Disc3 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const result = await signIn.email({
        email,
        password,
      })

      if (result.error) {
        setError(result.error.message || 'Erro ao fazer login')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Erro ao fazer login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="relative w-full max-w-md border-card bg-card p-8">
        <div className="mb-8 flex flex-col items-center gap-4">
          <Link
            href="/"
            className="absolute left-4 top-4 text-muted transition-all hover:text-primary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]"
          >
            ←
          </Link>
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-primary/50 bg-primary/10">
            <Disc3 className="h-10 w-10 animate-[spin_4s_linear_infinite] text-primary drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]" />
          </div>
          <h1 className="text-2xl font-bold text-text">Entrar no Chronicle</h1>
          <p className="text-sm text-muted">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-sm text-red-500">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-text">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 rounded-lg border-2 border-primary/50 bg-card px-3 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-text">
              Senha
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 rounded-lg border-2 border-primary/50 bg-card px-3 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <Button
            type="submit"
            className="h-10 w-full rounded-lg bg-primary font-medium text-background hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]"
            disabled={isLoading}
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted">
            Não tem uma conta?{' '}
            <Link
              href="/register"
              className="text-primary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)]"
            >
              Registrar
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}
