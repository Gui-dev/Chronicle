const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { body, headers = {}, ...rest } = options

    const hasBody = body !== undefined && body !== null
    const defaultHeaders: Record<string, string> = hasBody
      ? { 'Content-Type': 'application/json' }
      : {}

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...defaultHeaders,
        ...headers,
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: { message: 'Unknown error' },
      }))
      throw new Error(
        error.error?.message +
          (error.error?.details ? `: ${JSON.stringify(error.error.details)}` : '') ||
          `API error: ${response.status}`,
      )
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json()
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body })
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body })
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }
}

export const api = new ApiClient(API_BASE_URL)
