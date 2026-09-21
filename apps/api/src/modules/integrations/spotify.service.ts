import { env } from '../../env'

interface SpotifyTrack {
  id: string
  name: string
  artists: { name: string }[]
  album: {
    name: string
    images: { url: string }[]
  }
  external_urls: { spotify: string }
  preview_url: string | null
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[]
  }
}

export class SpotifyService {
  private accessToken: string | null = null
  private tokenExpiry = 0

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to get Spotify access token')
    }

    const data = (await response.json()) as { access_token: string; expires_in: number }
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + data.expires_in * 1000

    return this.accessToken!
  }

  async search(query: string, limit = 20): Promise<SpotifyTrack[]> {
    const token = await this.getAccessToken()

    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error('Failed to search Spotify')
    }

    const data = (await response.json()) as SpotifySearchResponse
    return data.tracks.items
  }
}

export const spotifyService = new SpotifyService()
