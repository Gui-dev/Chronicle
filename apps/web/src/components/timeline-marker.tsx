interface TimelineMarkerProps {
  date: string
  isLast?: boolean
}

export function TimelineMarker({ date, isLast = false }: TimelineMarkerProps) {
  const formattedDate = new Date(date).toLocaleDateString('pt-BR', {
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-col items-center">
        <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20 shadow-[0_0_8px_rgba(240,192,64,0.5)]" />
        {!isLast && <div className="h-full w-0.5 bg-card" />}
      </div>
      <span className="text-sm font-medium text-primary">{formattedDate}</span>
    </div>
  )
}
