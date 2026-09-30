'use client'

import { RequireAuth } from '@/components/require-auth'
import { useRevokeShare } from '@/hooks/use-revoke-share'
import { type SharedLink, useSharedLinks } from '@/hooks/use-shared-links'
import { Button, Card } from '@chronicle/ui'
import { Copy, Share2, XCircle } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

// Renders UTC dd/mm/yyyy to match share-dialog's formatDate — a local-tz
// value and the dialog's UTC value disagree near midnight.
function formatDay(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getUTCFullYear()}`
}

export default function SharedLinksPage() {
  return (
    <RequireAuth>
      <SharedLinksContent />
    </RequireAuth>
  )
}

function SharedLinksContent() {
  const { data, isLoading, isError } = useSharedLinks()
  const revoke = useRevokeShare()

  const handleCopy = async (link: SharedLink) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/share/${link.token}`)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  const handleRevoke = (link: SharedLink) => {
    revoke.mutate(link.id, {
      onSuccess: () => toast.success(`Link de "${link.title}" revogado`),
      onError: () => toast.error('Erro ao revogar o link'),
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Share2 className="h-6 w-6 text-muted" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-text">Compartilhamentos</h1>
      </div>
      <p className="mb-8 text-sm text-muted">
        Memórias com link ativo. Revogar mata o link na hora; renovar gera um token novo com 7 dias.
      </p>

      {isLoading ? (
        <p className="text-sm text-muted" data-testid="share-list-loading">
          Carregando...
        </p>
      ) : isError ? (
        <p className="text-sm text-red-500" data-testid="share-list-error">
          Não foi possível carregar os compartilhamentos. Tente novamente.
        </p>
      ) : !data || data.data.length === 0 ? (
        <Card className="border-card bg-card p-6">
          <p className="text-sm text-muted" data-testid="share-list-empty">
            Nenhuma memória está compartilhada no momento.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {data.data.map((link) => (
            <li key={link.id}>
              <Card className="border-card bg-card p-4" data-testid={`share-item-${link.id}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className="truncate font-medium text-text"
                      data-testid={`share-title-${link.id}`}
                    >
                      {link.title}
                    </p>
                    <p className="text-xs text-muted" data-testid={`share-expires-${link.id}`}>
                      {formatDay(link.memoryDate)} · expira em {formatDay(link.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleCopy(link)}
                      className="border-card text-text hover:border-primary hover:text-primary"
                      data-testid={`share-copy-${link.id}`}
                    >
                      <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRevoke(link)}
                      disabled={revoke.isPending}
                      className="border-card text-red-500 hover:border-red-500 hover:text-red-600"
                      data-testid={`share-revoke-${link.id}`}
                    >
                      <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                      Revogar
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <Link
          href="/profile"
          className="text-sm text-muted transition-colors hover:text-primary"
          data-testid="share-back-profile"
        >
          Voltar ao perfil
        </Link>
      </div>
    </div>
  )
}
