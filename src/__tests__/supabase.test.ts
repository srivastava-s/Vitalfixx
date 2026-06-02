import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('supabase configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('should not configure supabase if env vars are missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const { supabase, isSupabaseConfigured } = await import('../lib/supabase')

    expect(supabase).toBeNull()
    expect(isSupabaseConfigured()).toBe(false)
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL'),
      expect.any(String)
    )
  })

  it('should configure supabase if env vars are present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'

    const { supabase, isSupabaseConfigured } = await import('../lib/supabase')

    expect(supabase).not.toBeNull()
    expect(isSupabaseConfigured()).toBe(true)
    expect(console.warn).not.toHaveBeenCalled()
  })
})
