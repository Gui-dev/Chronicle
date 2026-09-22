'use client'

import type { CreateMemoryInput } from '@chronicle/schemas'
import { Input, Label } from '@chronicle/ui'
import type { UseFormReturn } from 'react-hook-form'

interface StepBasicInfoProps {
  form: UseFormReturn<CreateMemoryInput>
}

export function StepBasicInfo({ form }: StepBasicInfoProps) {
  const {
    register,
    formState: { errors },
  } = form

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Informações Básicas</h2>
        <p className="mt-1 text-sm text-muted">Conte-nos sobre este momento</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-medium text-text">
            Título *
          </Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Ex: Pôr do sol na praia"
            className="border-card bg-background text-text placeholder:text-muted"
          />
          {errors.title && <p className="text-sm text-red-500">{errors.title.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="memoryDate" className="text-sm font-medium text-text">
            Data *
          </Label>
          <Input
            id="memoryDate"
            type="date"
            {...register('memoryDate')}
            className="border-card bg-background text-text"
          />
          {errors.memoryDate && <p className="text-sm text-red-500">{errors.memoryDate.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="content" className="text-sm font-medium text-text">
            Texto
          </Label>
          <textarea
            id="content"
            {...register('content')}
            placeholder="Descreva este momento..."
            rows={4}
            className="w-full rounded-lg border-2 border-card bg-background px-3 py-2 text-text placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
