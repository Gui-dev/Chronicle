'use client'

import { useCreateMemory } from '@/hooks/use-create-memory'
import { createMemorySchema } from '@chronicle/schemas'
import type { CreateMemoryInput } from '@chronicle/schemas'
import { Button, Card } from '@chronicle/ui'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { StepBasicInfo } from './steps/step-basic-info'
import { StepLocation } from './steps/step-location'
import { StepMusic } from './steps/step-music'
import { StepPeople } from './steps/step-people'
import { StepPhotos } from './steps/step-photos'

const STEPS = [
  { id: 0, label: 'Básico' },
  { id: 1, label: 'Local' },
  { id: 2, label: 'Música' },
  { id: 3, label: 'Fotos' },
  { id: 4, label: 'Pessoas' },
]

export function CreateMemoryWizard() {
  const [currentStep, setCurrentStep] = useState(0)
  const [photos, setPhotos] = useState<File[]>([])
  const [people, setPeople] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])

  const createMemory = useCreateMemory()

  const form = useForm<CreateMemoryInput>({
    resolver: zodResolver(createMemorySchema),
    defaultValues: {
      title: '',
      content: '',
      memoryDate: new Date(),
    },
  })

  const { handleSubmit, trigger } = form

  const validateStep = async () => {
    if (currentStep === 0) {
      return await trigger(['title', 'memoryDate'])
    }
    return true
  }

  const handleNext = async () => {
    const isValid = await validateStep()
    if (isValid && currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const onSubmit = async (data: CreateMemoryInput) => {
    const memoryData = {
      ...data,
      people: people.length > 0 ? people : undefined,
      tags: tags.length > 0 ? tags : undefined,
    }

    const result = await createMemory.mutateAsync(memoryData)

    if (photos.length > 0 && result?.data?.id) {
      for (const photo of photos) {
        const formData = new FormData()
        formData.append('file', photo)

        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'}/api/memories/${result.data.id}/photos`,
          {
            method: 'POST',
            credentials: 'include',
            body: formData,
          },
        )
      }
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepBasicInfo form={form} />
      case 1:
        return <StepLocation form={form} />
      case 2:
        return <StepMusic form={form} />
      case 3:
        return <StepPhotos photos={photos} onPhotosChange={setPhotos} />
      case 4:
        return (
          <StepPeople
            form={form}
            people={people}
            onPeopleChange={setPeople}
            tags={tags}
            onTagsChange={setTags}
          />
        )
      default:
        return null
    }
  }

  return (
    <Card className="mx-auto max-w-2xl border-card bg-card p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  index === currentStep
                    ? 'bg-primary text-background'
                    : index < currentStep
                      ? 'bg-primary/20 text-primary'
                      : 'bg-background text-muted'
                }`}
              >
                {index < currentStep ? '✓' : index + 1}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`ml-2 h-0.5 w-8 ${
                    index < currentStep ? 'bg-primary' : 'bg-background'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {renderStep()}

        <div className="mt-8 flex justify-between">
          <Link href="/">
            <Button
              type="button"
              variant="outline"
              className="border-card text-text hover:border-primary hover:text-primary"
            >
              Cancelar
            </Button>
          </Link>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="inline-flex items-center gap-2 border-card text-text hover:border-primary hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createMemory.isPending}
                className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
              >
                {createMemory.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Memória'
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </Card>
  )
}
