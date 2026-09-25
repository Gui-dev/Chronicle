'use client'

import type { Memory } from '@/hooks/use-memories'
import { api } from '@/lib/api-client'
import { Button } from '@chronicle/ui'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'

interface NarrativeSectionProps {
  memoryId: string
  aiNarrative: string | null
}

interface NarrativeResult {
  narrative: string
  mood: string
  themes: string[]
}

export function NarrativeSection({ memoryId, aiNarrative }: NarrativeSectionProps) {
  const queryClient = useQueryClient()
  const [narrative, setNarrative] = useState<string | null>(aiNarrative)
  const [mood, setMood] = useState<string | null>(null)
  const [themes, setThemes] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const response = await api.post<{ data: NarrativeResult }>(
        `/api/memories/${memoryId}/generate-narrative`,
      )
      setNarrative(response.data.narrative)
      setMood(response.data.mood)
      setThemes(response.data.themes)
      queryClient.setQueryData<Memory>(['memory', memoryId], (old) =>
        old ? { ...old, aiNarrative: response.data.narrative } : old,
      )
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    } catch {
      // Error handled silently
    } finally {
      setIsGenerating(false)
    }
  }

  if (!narrative && !isGenerating) {
    return (
      <div className="rounded-xl border-2 border-dashed border-card p-8 text-center">
        <Sparkles className="mx-auto mb-4 h-8 w-8 text-muted" />
        <p className="mb-4 text-sm text-muted">
          Gere uma narrativa cinematográfica para esta memória
        </p>
        <Button
          onClick={handleGenerate}
          className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
        >
          <Sparkles className="h-4 w-4" />
          Gerar narrativa
        </Button>
      </div>
    )
  }

  if (isGenerating) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-card p-8">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        <span className="text-sm text-muted">Gerando narrativa...</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-text">Narrativa IA</h2>
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{narrative}</p>

      {(mood || themes.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-card pt-4 text-xs text-muted">
          {mood && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">Mood: {mood}</span>
          )}
          {themes.map((theme) => (
            <span key={theme} className="rounded-full bg-background px-3 py-1">
              {theme}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        className="mt-4 cursor-pointer text-xs text-muted transition-colors hover:text-primary"
      >
        Regenerar narrativa
      </button>
    </div>
  )
}
