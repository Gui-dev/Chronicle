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
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
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
