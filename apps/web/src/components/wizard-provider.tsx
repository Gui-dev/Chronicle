'use client'

import { useCreateMemory } from '@/hooks/use-create-memory'
import { usePhotoUpload } from '@/hooks/use-photo-upload'
import { api } from '@/lib/api-client'
import type { CreateMemoryFormValues, CreateMemoryInput } from '@chronicle/schemas'
import { createMemorySchema } from '@chronicle/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { useParams, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { type UseFormReturn, useForm } from 'react-hook-form'
import { toast } from 'sonner'

export const WIZARD_STEPS = [
  { id: 0, label: 'Básico' },
  { id: 1, label: 'Local' },
  { id: 2, label: 'Música' },
  { id: 3, label: 'Fotos' },
  { id: 4, label: 'Pessoas' },
] as const

export const WIZARD_STEP_COUNT = WIZARD_STEPS.length

const STORAGE_KEY = 'chronicle-wizard-draft'

interface WizardDraft {
  values: Partial<CreateMemoryFormValues>
  people: string[]
  tags: string[]
}

const EMPTY_DRAFT: WizardDraft = { values: {}, people: [], tags: [] }

function loadDraft(): WizardDraft {
  if (typeof window === 'undefined') return EMPTY_DRAFT
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_DRAFT
    const parsed = JSON.parse(raw) as Partial<WizardDraft>
    return {
      values: parsed.values ?? {},
      people: Array.isArray(parsed.people) ? parsed.people : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      // File objects are not serializable: photos are dropped on reload by design.
    }
  } catch {
    return EMPTY_DRAFT
  }
}

interface WizardContextValue {
  currentStep: number
  form: UseFormReturn<CreateMemoryFormValues, unknown, CreateMemoryInput>
  photos: File[]
  setPhotos: (photos: File[]) => void
  people: string[]
  setPeople: (people: string[]) => void
  tags: string[]
  setTags: (tags: string[]) => void
  isCreating: boolean
  isUploading: boolean
  progress: { current: number; total: number } | null
  validateStep: () => Promise<boolean>
  handleNext: () => Promise<void>
  handlePrevious: () => void
  onSubmit: (data: CreateMemoryInput) => Promise<void>
}

const WizardContext = createContext<WizardContextValue | null>(null)

export function useWizard(): WizardContextValue {
  const value = useContext(WizardContext)
  if (!value) throw new Error('useWizard must be used inside WizardProvider')
  return value
}

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const params = useParams<{ step: string }>()
  const parsed = Number(params.step)
  const currentStep =
    Number.isInteger(parsed) && parsed >= 0 && parsed < WIZARD_STEP_COUNT ? parsed : 0

  const createMemory = useCreateMemory()
  const { uploadPhotos, progress, isUploading } = usePhotoUpload()

  const draft = useMemo(loadDraft, [])
  const [photos, setPhotos] = useState<File[]>([])
  const [people, setPeople] = useState<string[]>(draft.people)
  const [tags, setTags] = useState<string[]>(draft.tags)

  const form = useForm<CreateMemoryFormValues, unknown, CreateMemoryInput>({
    resolver: zodResolver(createMemorySchema),
    defaultValues: {
      title: '',
      content: '',
      memoryDate: new Date().toISOString().split('T')[0],
      ...draft.values,
    },
  })

  // The draft is best-effort: written whenever form values or chips change so
  // a reload lands the user back where they were (photos excepted).
  useEffect(() => {
    const save = (values: Partial<CreateMemoryFormValues>) => {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ values, people, tags }))
      } catch {
        // storage unavailable — drafts are optional
      }
    }
    save(form.getValues())
    const subscription = form.watch((values) => save(values))
    return () => subscription.unsubscribe()
  }, [form, people, tags])

  const validateStep = useCallback(async () => {
    if (currentStep !== 0) return true
    return await form.trigger(['title', 'memoryDate'])
  }, [currentStep, form])

  const handleNext = useCallback(async () => {
    const isValid = await validateStep()
    if (isValid && currentStep < WIZARD_STEP_COUNT - 1) {
      router.push(`/memories/new/${currentStep + 1}`)
    }
  }, [currentStep, router, validateStep])

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) router.push(`/memories/new/${currentStep - 1}`)
  }, [currentStep, router])

  const onSubmit = useCallback(
    async (data: CreateMemoryInput) => {
      const memoryData: CreateMemoryInput = {
        ...data,
        memoryDate: data.memoryDate,
        people: people.length > 0 ? people : undefined,
        tags: tags.length > 0 ? tags : undefined,
      }

      const result = await createMemory.mutateAsync(memoryData)

      if (photos.length > 0 && result?.data?.id) {
        const memoryId = result.data.id
        try {
          await uploadPhotos(memoryId, photos)
        } catch {
          await api.delete(`/api/memories/${memoryId}`).catch(() => {})
          toast.error('Não foi possível salvar as fotos. A memória não foi criada.')
          return
        }
      }

      toast.success('Memória criada!')
      window.sessionStorage.removeItem(STORAGE_KEY)
      router.push('/')
    },
    [createMemory, people, photos, router, tags, uploadPhotos],
  )

  const value: WizardContextValue = {
    currentStep,
    form,
    photos,
    setPhotos,
    people,
    setPeople,
    tags,
    setTags,
    isCreating: createMemory.isPending,
    isUploading,
    progress,
    validateStep,
    handleNext,
    handlePrevious,
    onSubmit,
  }

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
}
