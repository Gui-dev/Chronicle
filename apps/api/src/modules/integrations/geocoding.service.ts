interface GeocodingResult {
  id: number
  name: string
  latitude: number
  longitude: number
  country: string
  admin1?: string
}

export class GeocodingService {
  async search(query: string, limit = 5): Promise<GeocodingResult[]> {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=${limit}&language=en&format=json`,
    )

    if (!response.ok) {
      throw new Error('Failed to fetch geocoding data')
    }

    const data = (await response.json()) as { results?: GeocodingResult[] }
    return data.results || []
  }
}

export const geocodingService = new GeocodingService()
