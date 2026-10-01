'use client'

import { StepBasicInfo } from '@/components/steps/step-basic-info'
import { StepLocation } from '@/components/steps/step-location'
import { StepMusic } from '@/components/steps/step-music'
import { StepPeople } from '@/components/steps/step-people'
import { StepPhotos } from '@/components/steps/step-photos'
import { useWizard } from '@/components/wizard-provider'
import { WizardShell } from '@/components/wizard-shell'
import { notFound, useParams } from 'next/navigation'
import type { ReactNode } from 'react'

function StepContent({ step }: { step: number }) {
  const { form, photos, setPhotos, people, setPeople, tags, setTags } = useWizard()

  let content: ReactNode
  switch (step) {
    case 0:
      content = <StepBasicInfo form={form} />
      break
    case 1:
      content = <StepLocation form={form} />
      break
    case 2:
      content = <StepMusic form={form} />
      break
    case 3:
      content = <StepPhotos photos={photos} onPhotosChange={setPhotos} />
      break
    case 4:
      content = (
        <StepPeople
          form={form}
          people={people}
          onPeopleChange={setPeople}
          tags={tags}
          onTagsChange={setTags}
        />
      )
      break
    default:
      return notFound()
  }

  return <WizardShell>{content}</WizardShell>
}

export default function WizardStepPage() {
  const params = useParams<{ step: string }>()
  const step = Number(params.step)
  if (!Number.isInteger(step) || step < 0 || step > 4) notFound()
  return <StepContent step={step} />
}
