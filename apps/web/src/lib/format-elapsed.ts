export function formatElapsed(dateA: string, dateB: string): string {
  const a = new Date(dateA)
  const b = new Date(dateB)
  const diffMs = b.getTime() - a.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 1) return 'No mesmo dia'
  if (diffDays === 1) return '1 dia depois'
  if (diffDays < 7) return `${diffDays} dias depois`
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} depois`
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return `${months} ${months === 1 ? 'mês' : 'meses'} depois`
  }
  const years = Math.floor(diffDays / 365)
  return `${years} ${years === 1 ? 'ano' : 'anos'} depois`
}
