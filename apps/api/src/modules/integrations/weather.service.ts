interface WeatherResponse {
  current: {
    temperature_2m: number
    relative_humidity_2m: number
    weather_code: number
    wind_speed_10m: number
  }
}

interface WeatherResult {
  temperature: number
  humidity: number
  weatherCode: number
  windSpeed: number
  description: string
  icon: string
}

const WMO_CODES: Record<number, string> = {
  0: 'Céu limpo',
  1: 'Principalmente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Nevoeiro',
  48: 'Nevoeiro com geada',
  51: 'Chuvisco leve',
  53: 'Chuvisco moderado',
  55: 'Chuvisco forte',
  61: 'Chuva leve',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  71: 'Neve leve',
  73: 'Neve moderada',
  75: 'Neve forte',
  80: 'Pancadas de chuva leve',
  81: 'Pancadas de chuva moderada',
  82: 'Pancadas de chuva forte',
  95: 'Tempestade',
  96: 'Tempestade com granizo leve',
  99: 'Tempestade com granizo forte',
}

const WMO_ICONS: Record<number, string> = {
  0: '\u2600\uFE0F',
  1: '\uD83C\uDF24',
  2: '\u26C5',
  3: '\u2601\uFE0F',
  45: '\uD83C\uDF2B',
  48: '\uD83C\uDF2B',
  51: '\uD83C\uDF26',
  53: '\uD83C\uDF26',
  55: '\uD83C\uDF27',
  61: '\uD83C\uDF27',
  63: '\uD83C\uDF27',
  65: '\uD83C\uDF27',
  71: '\u2744\uFE0F',
  73: '\u2744\uFE0F',
  75: '\u2744\uFE0F',
  80: '\uD83C\uDF26',
  81: '\uD83C\uDF27',
  82: '\u26C8',
  95: '\u26C8',
  96: '\u26C8',
  99: '\u26C8',
}

export class WeatherService {
  async getCurrentWeather(latitude: number, longitude: number): Promise<WeatherResult> {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`,
    )

    if (!response.ok) {
      throw new Error('Failed to fetch weather data')
    }

    const data = (await response.json()) as WeatherResponse

    return {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      weatherCode: data.current.weather_code,
      windSpeed: data.current.wind_speed_10m,
      description: WMO_CODES[data.current.weather_code] || 'Unknown',
      icon: WMO_ICONS[data.current.weather_code] || '\uD83C\uDF24',
    }
  }
}

export const weatherService = new WeatherService()
