'use client'

import { Button, Input, Label } from '@chronicle/ui'
import { X } from 'lucide-react'
import { useCallback, useState } from 'react'

interface ChipInputProps {
  label: string
  placeholder: string
  value: string[]
  onChange: (value: string[]) => void
  maxLength?: number
}

export function ChipInput({
  label,
  placeholder,
  value,
  onChange,
  maxLength = 100,
}: ChipInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addChip = useCallback(() => {
    const trimmed = inputValue.trim()
    if (trimmed && !value.includes(trimmed) && trimmed.length <= maxLength) {
      onChange([...value, trimmed])
      setInputValue('')
    }
  }, [inputValue, value, onChange, maxLength])

  const removeChip = useCallback(
    (chipToRemove: string) => {
      onChange(value.filter((chip) => chip !== chipToRemove))
    },
    [value, onChange],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addChip()
      }
    },
    [addChip],
  )

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-text">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 border-card bg-background text-text placeholder:text-muted"
        />
        <Button
          type="button"
          variant="outline"
          onClick={addChip}
          disabled={!inputValue.trim()}
          className="border-card text-text hover:border-primary hover:text-primary"
        >
          Adicionar
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {value.map((chip) => (
            <span
              key={chip}
              className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary"
            >
              {chip}
              <button
                type="button"
                onClick={() => removeChip(chip)}
                className="ml-1 hover:text-secondary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
