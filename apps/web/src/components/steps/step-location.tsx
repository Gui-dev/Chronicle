'use client'

import { useGeocoding } from '@/hooks/use-geocoding'
import type { GeocodingResult } from '@/hooks/use-geocoding'
import { useWeather } from '@/hooks/use-weather'
import type { CreateMemoryInput } from '@chronicle/schemas'
import { Input, Label } from '@chronicle/ui'
import { Cloud, MapPin } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'

interface StepLocationProps {
  form: UseFormReturn<CreateMemoryInput, any>
}

export function StepLocation({ form }: StepLocationProps) {
  const { setValue, watch } = form
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const locationName = watch('locationName')
  const locationLat = watch('locationLat')
  const locationLng = watch('locationLng')

  const { data: geocodingData } = useGeocoding(debouncedSearch)
  const { data: weatherData } = useWeather(locationLat ?? null, locationLng ?? null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  const selectLocation = useCallback(
    (result: GeocodingResult) => {
      setValue('locationName', `${result.name}, ${result.country}`)
      setValue('locationLat', result.latitude)
      setValue('locationLng', result.longitude)
      setSearchTerm('')
      setDebouncedSearch('')
    },
    [setValue],
  )

  useEffect(() => {
    if (weatherData?.data) {
      setValue('weatherTemp', weatherData.data.temperature)
      setValue('weatherDesc', weatherData.data.description)
      setValue('weatherIcon', weatherData.data.icon)
    }
  }, [weatherData, setValue])

  const locations = geocodingData?.data || []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-text">Localização</h2>
        <p className="mt-1 text-sm text-muted">Onde aconteceu este momento?</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-text">Buscar localização</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome do local..."
              className="border-card bg-background pl-10 text-text placeholder:text-muted"
            />
          </div>
        </div>

        {locations.length > 0 && (
          <div className="space-y-2">
            {locations.map((loc, index) => (
              <button
                key={`${loc.latitude}-${loc.longitude}-${index}`}
                type="button"
                onClick={() => selectLocation(loc)}
                className="w-full cursor-pointer rounded-lg border-2 border-card bg-card p-3 text-left transition-all hover:border-primary/30"
              >
                <p className="font-medium text-text">{loc.name}</p>
                <p className="text-sm text-muted">
                  {loc.admin1 ? `${loc.admin1}, ` : ''}
                  {loc.country}
                </p>
              </button>
            ))}
          </div>
        )}

        {locationName && (
          <div className="rounded-lg bg-primary/10 p-3">
            <p className="text-sm font-medium text-primary">{locationName}</p>
          </div>
        )}

        {weatherData?.data && (
          <div className="flex items-center gap-3 rounded-lg bg-background p-3">
            <Cloud className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium text-text">
                {weatherData.data.temperature}° — {weatherData.data.description}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
