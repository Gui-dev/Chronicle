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
    }
  }
}

export const weatherService = new WeatherService()
