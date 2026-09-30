'use client'

import type { Memory } from '@/hooks/use-memories'
import { useRevokeShare } from '@/hooks/use-revoke-share'
import { api } from '@/lib/api-client'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@chronicle/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Link2, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ShareDialogProps {
  memoryId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function ShareDialog({ memoryId, open, onOpenChange }: ShareDialogProps) {
  const queryClient = useQueryClient()
  const revoke = useRevokeShare()

  // Same query key as useMemory: opening the dialog reuses a cached detail
  // read instead of fetching a second copy of the memory.
  const detail = useQuery({
    queryKey: ['memory', memoryId],
    queryFn: async () => {
      const { data } = await api.get<{ data: Memory }>(`/api/memories/${memoryId}`)
      return data
    },
    enabled: open,
  })

  const token = detail.data?.shareToken ?? null
  const expiresAt = detail.data?.shareExpiresAt ?? null
  const shareUrl =
    token && typeof window !== 'undefined' ? `${window.location.origin}/share/${token}` : ''

  const shareMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ data: { token: string; expiresAt: string } }>(
        `/api/memories/${memoryId}/share`,
      )
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memory', memoryId] })
      toast.success('Link gerado!')
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar o link')
    },
  })

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Link copiado')
    } catch {
      toast.error('Não foi possível copiar o link')
    }
  }

  const handleRevoke = () => {
    revoke.mutate(memoryId, {
      onSuccess: () => toast.success('Link revogado'),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Erro ao revogar o link')
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-card bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-text">Compartilhar memória</DialogTitle>
          <DialogDescription className="text-muted">
            Quem tem o link vê a memória por 7 dias, sem os seus dados pessoais.
          </DialogDescription>
        </DialogHeader>

        {detail.isLoading ? (
          <div className="flex justify-center py-6" data-testid="share-loading">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {token && expiresAt ? (
              <div className="space-y-2">
                <p className="text-sm text-text" data-testid="share-active">
                  Link ativo — expira em {formatDate(expiresAt)}
                </p>
                <code
                  className="block break-all rounded-lg border border-card bg-background p-2 font-mono text-xs text-primary"
                  data-testid="share-url"
                >
                  {shareUrl}
                </code>
              </div>
            ) : (
              <p className="text-sm text-muted" data-testid="share-none">
                Sem link ativo. Gere um link para quem quiser ver esta memória.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => shareMutation.mutate()}
                disabled={shareMutation.isPending}
                data-testid="share-generate"
                className="bg-primary text-background hover:bg-secondary"
              >
                {shareMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : token ? (
                  <RefreshCw className="mr-2 h-4 w-4" />
                ) : (
                  <Link2 className="mr-2 h-4 w-4" />
                )}
                {token ? 'Renovar link' : 'Gerar link'}
              </Button>

              <Button
                variant="outline"
                onClick={handleCopy}
                disabled={!token}
                data-testid="share-copy"
                className="border-card text-text hover:border-primary hover:text-primary"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>

              <Button
                variant="outline"
                onClick={handleRevoke}
                disabled={!token || revoke.isPending}
                data-testid="share-revoke"
                className="border-card text-red-500 hover:border-red-500 hover:text-red-600"
              >
                {revoke.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Revogar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
