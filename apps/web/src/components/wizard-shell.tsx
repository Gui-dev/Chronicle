'use client'

import { WIZARD_STEPS, WIZARD_STEP_COUNT, useWizard } from '@/components/wizard-provider'
import { Button, Card } from '@chronicle/ui'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react'

export function WizardShell({ children }: { children: ReactNode }) {
  const {
    currentStep,
    form,
    isCreating,
    isUploading,
    progress,
    handleNext,
    handlePrevious,
    onSubmit,
  } = useWizard()
  const { handleSubmit } = form
  const containerRef = useRef<HTMLDivElement>(null)

  // Every step page mounts fresh: hand focus to the step heading so keyboard
  // and screen-reader users land where the content changed (spec §1).
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-focus the heading on every step change, not only on mount
  useEffect(() => {
    const heading = containerRef.current?.querySelector<HTMLElement>('h2')
    heading?.focus()
  }, [currentStep])

  // Enter in a field advances instead of submitting the wizard halfway
  // through. The chip inputs call preventDefault first, textareas keep their
  // newline, and buttons keep their native activation.
  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.metaKey || event.ctrlKey) return
    const target = event.target
    if (target instanceof HTMLTextAreaElement) return
    if (target instanceof HTMLButtonElement) return
    if (target instanceof HTMLInputElement && !['text', 'date', 'search'].includes(target.type)) {
      return
    }
    if (currentStep >= WIZARD_STEP_COUNT - 1) return
    event.preventDefault()
    void handleNext()
  }

  return (
    <div ref={containerRef}>
      <Card className="mx-auto max-w-2xl border-card bg-card p-4 sm:p-6">
        <div className="mb-6">
          <div
            className="flex items-center justify-between"
            // biome-ignore lint/a11y/useSemanticElements: fieldset groups form controls; this groups decorative progress steps
            role="group"
            aria-label="Progresso da criação da memória"
          >
            {WIZARD_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  aria-current={index === currentStep ? 'step' : undefined}
                  aria-label={`Passo ${index + 1}: ${step.label}`}
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
                {index < WIZARD_STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={`ml-2 hidden h-0.5 w-8 sm:block ${
                      index < currentStep ? 'bg-primary' : 'bg-background'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown}>
          {children}

          <span aria-live="assertive" aria-atomic="true" className="sr-only">
            {isUploading && progress
              ? `Enviando foto ${progress.current} de ${progress.total}`
              : ''}
          </span>

          <div className="mt-8 flex justify-between">
            <Link href="/" prefetch={false}>
              <Button
                type="button"
                variant="outline"
                className="border-input text-text hover:border-primary hover:text-primary"
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
                className="inline-flex items-center gap-2 border-input text-text hover:border-primary hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Button>

              {currentStep < WIZARD_STEP_COUNT - 1 ? (
                <Button
                  type="button"
                  onClick={() => void handleNext()}
                  className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
                >
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={isCreating || isUploading}
                  data-testid="submit-memory"
                  className="inline-flex items-center gap-2 bg-primary text-background hover:bg-secondary"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Criando...
                    </>
                  ) : isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {progress
                        ? `Enviando foto ${progress.current} de ${progress.total}...`
                        : 'Enviando fotos...'}
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
    </div>
  )
}
