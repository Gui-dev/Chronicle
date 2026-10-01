'use client'

import { MemoryCardFull } from '@/components/memory-card'
import { useAuth } from '@/hooks/use-auth'
import { useMemory } from '@/hooks/use-memory'
import { Button } from '@chronicle/ui'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function MemoryViewPage() {
  const params = useParams()
  const id = params.id as string
  const { data: memory, isLoading, error } = useMemory(id)
  const { user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !memory) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/" className="mb-6 inline-block">
          <Button
            variant="outline"
            className="border-input text-text hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para timeline
          </Button>
        </Link>
        <p className="text-red-500">Memória não encontrada</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="mb-6 inline-block">
        <Button
          variant="outline"
          className="border-input text-text hover:border-primary hover:text-primary"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para timeline
        </Button>
      </Link>
      <MemoryCardFull memory={memory} isOwner={user?.id === memory.userId} />
    </div>
  )
}
