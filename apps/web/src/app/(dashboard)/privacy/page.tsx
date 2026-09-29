'use client'

import { RequireAuth } from '@/components/require-auth'
import { useAuth } from '@/hooks/use-auth'
import { API_BASE_URL, api } from '@/lib/api-client'
import { Button, Card } from '@chronicle/ui'
import { Download, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

const POLL_INTERVAL_MS = 400
// Two minutes at 400ms: long enough for an account with photos, short enough
// that a stuck job becomes an error instead of a spinner that never ends.
const MAX_POLLS = 300

interface StartedExport {
  data: { jobId: string; status: string; error: string | null }
}

interface ExportStatus {
  data: { jobId: string; status: string; error: string | null }
}

function PrivacyContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      // The API collects the data in a background job; this page only starts
      // it and polls until the file is ready.
      const started = await api.post<StartedExport>('/api/export')
      let { jobId, status, error } = started.data

      for (let polls = 0; status !== 'done' && polls < MAX_POLLS; polls++) {
        if (status === 'failed') {
          throw new Error(error ?? 'A exportação falhou')
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        const view = await api.get<ExportStatus>(`/api/export/${jobId}`)
        status = view.data.status
        error = view.data.error
      }

      if (status === 'failed') {
        throw new Error(error ?? 'A exportação falhou')
      }
      if (status !== 'done') {
        throw new Error('A exportação demorou mais que o esperado')
      }

      const response = await fetch(`${API_BASE_URL}/api/export/${jobId}/download`, {
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Falha ao baixar a exportação')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chronicle-export-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Exportação concluída!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar dados')
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    try {
      await api.delete('/api/users/account')
      toast.success('Conta excluída')
      router.push('/')
    } catch {
      toast.error('Erro ao excluir conta')
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold text-text">Privacidade e Dados</h1>

      <div className="space-y-6">
        <Card className="border-card bg-card p-6">
          <h2 className="mb-2 text-xl font-semibold text-text">Exportar dados</h2>
          <p className="mb-4 text-sm text-muted">
            Seus dados são preparados em segundo plano em JSON, com as fotos embutidas. O download
            começa quando a exportação terminar.
          </p>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
            data-testid="export-start"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {isExporting ? 'Preparando exportação...' : 'Exportar meus dados'}
          </Button>
        </Card>

        <Card className="border-red-500/30 bg-card p-6">
          <h2 className="mb-2 text-xl font-semibold text-red-500">Excluir conta</h2>
          <p className="mb-4 text-sm text-muted">
            Esta ação é permanente. Todas as suas memórias, fotos e dados serão removidos.
          </p>
          {!confirmDelete ? (
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 border-red-500/50 text-red-500 hover:border-red-500 hover:text-red-600"
              data-testid="delete-account-start"
            >
              <Trash2 className="h-4 w-4" />
              Excluir minha conta
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-red-500">
                Tem certeza? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                  className="bg-red-500 text-white hover:bg-red-600"
                  data-testid="delete-account-confirm"
                >
                  {isDeleting ? 'Excluindo...' : 'Sim, excluir definitivamente'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  className="border-card text-text hover:border-primary hover:text-primary"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>

        {user && (
          <Card className="border-card bg-card p-6">
            <h2 className="mb-2 text-xl font-semibold text-text">Seus dados</h2>
            <div className="space-y-2 text-sm text-muted">
              <p>
                <span className="font-medium text-text">Nome:</span> {user.name}
              </p>
              <p>
                <span className="font-medium text-text">Email:</span> {user.email}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <RequireAuth>
      <PrivacyContent />
    </RequireAuth>
  )
}
