'use client'

import { RequireAuth } from '@/components/require-auth'
import { useAuth } from '@/hooks/use-auth'
import { useMemories } from '@/hooks/use-memories'
import { api } from '@/lib/api-client'
import { getInitials } from '@/lib/get-initials'
import { Button, Card, CardContent } from '@chronicle/ui'
import { Camera, Library, Loader2, Mail, Trash2, User } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const AVATAR_UPLOAD_URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/api/users/avatar`
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string }
  } | null
  return payload?.error?.message ?? fallback
}

export default function ProfilePage() {
  const { user, invalidateSession } = useAuth()
  const { data: memoriesData } = useMemories({ page: 1, limit: 1, mine: true })
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)

  useEffect(() => {
    if (user?.image) setAvatarFailed(false)
  }, [user?.image])

  const memoryCount = memoriesData?.pagination.total ?? 0
  const busy = uploading || removing

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    if (file.size > MAX_AVATAR_BYTES) {
      toast.error('A imagem deve ter no máximo 5MB')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(AVATAR_UPLOAD_URL, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        const message = await readErrorMessage(response, 'Não foi possível enviar a imagem')
        throw new Error(message)
      }

      setAvatarFailed(false)
      await invalidateSession()
      toast.success('Foto atualizada!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar a imagem')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    setRemoving(true)
    try {
      await api.delete('/api/users/avatar')
      setAvatarFailed(false)
      await invalidateSession()
      toast.success('Foto removida')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover a foto')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <RequireAuth>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text">Perfil</h1>
          <p className="mt-2 text-muted">Sua foto e suas informações</p>
        </div>

        <Card className="border-card bg-card p-6 sm:p-8">
          <CardContent className="flex flex-col items-center gap-6 p-0 text-center">
            <div
              className="h-24 w-24 overflow-hidden rounded-full border-2 border-primary/30 bg-background"
              data-testid="profile-avatar"
            >
              {user?.image && !avatarFailed ? (
                <Image
                  src={user.image}
                  alt={user.name || 'Avatar'}
                  width={96}
                  height={96}
                  sizes="96px"
                  className="h-24 w-24 object-cover"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <span className="grid h-24 w-24 place-items-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
                  {getInitials(user?.name, user?.email)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <input
                id="avatar-file"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="peer sr-only"
                data-testid="avatar-input"
                onChange={handleAvatarChange}
                disabled={uploading}
              />
              <label
                htmlFor="avatar-file"
                data-testid="avatar-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background transition-all hover:bg-secondary hover:drop-shadow-[0_0_8px_rgba(240,192,64,0.8)] peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {uploading ? 'Enviando...' : 'Alterar foto'}
              </label>

              {user?.image && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRemoveAvatar}
                  disabled={busy}
                  data-testid="remove-avatar"
                  className="inline-flex items-center gap-2 rounded-lg border-card text-text hover:border-red-500 hover:text-red-500"
                >
                  {removing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {removing ? 'Removendo...' : 'Remover foto'}
                </Button>
              )}
            </div>

            <p className="text-xs text-muted">PNG, JPEG ou WEBP. Até 5MB.</p>
          </CardContent>
        </Card>

        <Card className="mt-6 border-card bg-card p-6 sm:p-8">
          <CardContent className="space-y-5 p-0">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <span className="block text-xs uppercase tracking-wider text-muted">Nome</span>
                <span className="block truncate font-medium text-text" data-testid="profile-name">
                  {user?.name || 'Sem nome'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Mail className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <span className="block text-xs uppercase tracking-wider text-muted">Email</span>
                <span className="block truncate font-medium text-text" data-testid="profile-email">
                  {user?.email}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Library className="h-5 w-5" />
              </div>
              <div className="min-w-0 text-left">
                <span className="block text-xs uppercase tracking-wider text-muted">Memórias</span>
                <span className="block font-medium text-text" data-testid="profile-memory-count">
                  {memoryCount} {memoryCount === 1 ? 'memória' : 'memórias'}
                </span>
              </div>
            </div>

            <Link
              href="/my-memories"
              data-testid="profile-my-memories-link"
              className="inline-flex items-center gap-2 rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium text-primary transition-all hover:bg-primary/10"
            >
              <Library className="h-4 w-4" />
              Ver minhas memórias
            </Link>
          </CardContent>
        </Card>
      </div>
    </RequireAuth>
  )
}
