import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  authenticateApiRequest,
  isApiError,
  apiErrorResponse,
  withRateLimitHeaders,
  generateApiKey,
  createApiKey,
  revokeApiKey
} from '@/lib/api-auth'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}))

vi.mock('next/server', () => {
  return {
    NextRequest: class {
      headers: Headers
      constructor(input: string, init?: RequestInit) {
        this.headers = new Headers(init?.headers)
      }
    },
    NextResponse: {
      json: vi.fn().mockImplementation(function (body, init) {
        return { body, status: init?.status, headers: new Headers(init?.headers) }
      }),
      next: vi.fn(),
      redirect: vi.fn(),
    }
  }
})



describe('authenticateApiRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails if Authorization header is missing', async () => {
    const req = new NextRequest('http://localhost/api/test')
    const result = await authenticateApiRequest(req)
    expect(isApiError(result)).toBe(true)
    if (isApiError(result)) {
      expect(result.code).toBe('AUTH_MISSING')
      expect(result.status).toBe(401)
    }
  })

  it('fails if Authorization header does not start with Bearer', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Basic xyz' }
    })
    const result = await authenticateApiRequest(req)
    expect(isApiError(result)).toBe(true)
    if (isApiError(result)) {
      expect(result.code).toBe('AUTH_MISSING')
    }
  })

  it('fails if API key is too short', async () => {
    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer shortkey' }
    })
    const result = await authenticateApiRequest(req)
    expect(isApiError(result)).toBe(true)
    if (isApiError(result)) {
      expect(result.code).toBe('AUTH_INVALID')
      expect(result.status).toBe(401)
    }
  })

  it('fails if API key is not found in database', async () => {
    vi.mocked(supabase!.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' }
          })
        })
      })
    } as any)

    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer a_valid_length_api_key_here' }
    })
    const result = await authenticateApiRequest(req)
    expect(isApiError(result)).toBe(true)
    if (isApiError(result)) {
      expect(result.code).toBe('AUTH_INVALID_KEY')
      expect(result.status).toBe(401)
    }
  })

  it('fails if user plan has no API access', async () => {
    vi.mocked(supabase!.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-1', plan: 'free' },
            error: null
          })
        })
      })
    } as any)

    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer a_valid_length_api_key_here' }
    })
    const result = await authenticateApiRequest(req)
    expect(isApiError(result)).toBe(true)
    if (isApiError(result)) {
      expect(result.code).toBe('PLAN_NO_API')
      expect(result.status).toBe(403)
    }
  })

  it('fails if rate limit is exceeded', async () => {
    const today = new Date().toISOString().slice(0, 10)
    vi.mocked(supabase!.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-1',
              plan: 'pro',
              api_daily_count: 1000,
              api_daily_reset: today
            },
            error: null
          })
        })
      })
    } as any)

    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer a_valid_length_api_key_here' }
    })
    const result = await authenticateApiRequest(req)
    expect(isApiError(result)).toBe(true)
    if (isApiError(result)) {
      expect(result.code).toBe('RATE_LIMIT')
      expect(result.status).toBe(429)
    }
  })

  it('resets daily count on a new day and succeeds', async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })

    vi.mocked(supabase!.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-1',
              plan: 'pro',
              api_daily_count: 1000, // Should reset
              api_daily_reset: yesterday
            },
            error: null
          })
        })
      }),
      update: mockUpdate
    } as any)

    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer a_valid_length_api_key_here' }
    })
    const result = await authenticateApiRequest(req)
    expect(isApiError(result)).toBe(false)
    if (!isApiError(result)) {
      expect(result.apiUsed).toBe(1)
      expect(result.apiLimit).toBe(1000)
    }
    expect(mockUpdate).toHaveBeenCalledTimes(2) // 1 to reset, 1 to increment
  })

  it('succeeds and increments API count on the same day', async () => {
    const today = new Date().toISOString().slice(0, 10)
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })

    vi.mocked(supabase!.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-1',
              plan: 'pro',
              api_daily_count: 5,
              api_daily_reset: today
            },
            error: null
          })
        })
      }),
      update: mockUpdate
    } as any)

    const req = new NextRequest('http://localhost/api/test', {
      headers: { authorization: 'Bearer a_valid_length_api_key_here' }
    })
    const result = await authenticateApiRequest(req)
    expect(isApiError(result)).toBe(false)
    if (!isApiError(result)) {
      expect(result.apiUsed).toBe(6)
      expect(result.plan).toBe('pro')
    }
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })
})

describe('api-auth helper functions', () => {
  it('isApiError returns correct boolean', () => {
    expect(isApiError({ error: 'msg', code: 'CODE', status: 400 })).toBe(true)
    expect(isApiError({ user: {} as any, plan: 'pro', apiUsed: 1, apiLimit: 10, apiRemaining: 9 })).toBe(false)
  })

  it('apiErrorResponse creates correct NextResponse', () => {
    const res = apiErrorResponse({ error: 'test error', code: 'TEST_CODE', status: 403 }) as any

    expect(res.status).toBe(403)
    expect(res.body).toEqual({ error: 'test error', code: 'TEST_CODE' })
    expect(res.headers.get('x-ratelimit-error')).toBe('TEST_CODE') // Headers convert to lowercase
  })

  it('withRateLimitHeaders sets headers on NextResponse', () => {
    // using Headers map because of mock
    const res = {
      headers: new Map(),
    } as unknown as NextResponse

    // We mocked Headers in next/server, so let's make it more robust
    Object.defineProperty(res, 'headers', { value: new Headers(), writable: true })

    const result = withRateLimitHeaders(res, {
      user: {} as any,
      plan: 'pro',
      apiUsed: 5,
      apiLimit: 100,
      apiRemaining: 95
    })

    expect(result.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(result.headers.get('X-RateLimit-Used')).toBe('5')
    expect(result.headers.get('X-RateLimit-Remaining')).toBe('95')
  })

  it('generateApiKey generates a valid format', () => {
    const key = generateApiKey()
    expect(key.startsWith('vf_')).toBe(true)
    expect(key.length).toBeGreaterThan(20)
  })
})

describe('api key management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createApiKey generates and saves a new key', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })

    const mockClient = {
      from: vi.fn().mockReturnValue({
        update: mockUpdate
      })
    } as any

    const key = await createApiKey('user-1', mockClient)

    expect(key).toBeDefined()
    expect(key?.startsWith('vf_')).toBe(true)

    expect(mockClient.from).toHaveBeenCalledWith('profiles')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      api_key: key,
      api_key_created_at: expect.any(String)
    }))
  })

  it('createApiKey handles database error', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'db error' } })
    })

    const mockClient = {
      from: vi.fn().mockReturnValue({
        update: mockUpdate
      })
    } as any

    const originalConsoleError = console.error
    console.error = vi.fn() // Silence the expected error log

    const key = await createApiKey('user-1', mockClient)

    expect(key).toBeNull()
    expect(console.error).toHaveBeenCalled()

    console.error = originalConsoleError
  })

  it('revokeApiKey clears key from database', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    })

    const mockClient = {
      from: vi.fn().mockReturnValue({
        update: mockUpdate
      })
    } as any

    const success = await revokeApiKey('user-1', mockClient)

    expect(success).toBe(true)

    expect(mockClient.from).toHaveBeenCalledWith('profiles')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      api_key: null,
      api_key_created_at: null,
      api_daily_count: 0
    }))
  })

  it('revokeApiKey handles database error', async () => {
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: { message: 'db error' } })
    })

    const mockClient = {
      from: vi.fn().mockReturnValue({
        update: mockUpdate
      })
    } as any

    const success = await revokeApiKey('user-1', mockClient)

    expect(success).toBe(false)
  })
})
