'use client'

import { ChipInput } from '@/components/chip-input'
import type { CreateMemoryInput } from '@chronicle/schemas'
import type { UseFormReturn } from 'react-hook-form'

interface StepPeopleProps {
  form: UseFormReturn<CreateMemoryInput>
  people: string[]
  onPeopleChange: (people: string[]) => void
  tags: string[]
  onTagsChange: (tags: string[]) => void
}

export function StepPeople({
  form: _form,
  people,
  onPeopleChange,
  tags,
  onTagsChange,
}: StepPeopleProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Pessoas e Tags</h2>
        <p className="mt-1 text-sm text-muted">
          Quem estava presente e como categorizar esta memória?
        </p>
      </div>

      <div className="space-y-6">
        <ChipInput
          label="Pessoas"
          placeholder="Digite o nome e pressione Enter"
          value={people}
          onChange={onPeopleChange}
          maxLength={255}
        />

        <ChipInput
          label="Tags"
          placeholder="Ex: viagem, família, festa"
          value={tags}
          onChange={onTagsChange}
          maxLength={100}
        />
      </div>
    </div>
  )
}
