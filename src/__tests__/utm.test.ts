import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { captureUTM, getUTM, getUTMMetadata, UTMData } from '@/lib/utm'

const UTM_STORAGE_KEY = 'vitalfix-utm'

describe('UTM & Referral Tracking', () => {
  let mockStorage: Record<string, string> = {}

  beforeEach(() => {
    mockStorage = {}

    // Mock sessionStorage
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockStorage[key]
      }),
      clear: vi.fn(() => {
        mockStorage = {}
      })
    })

    // Mock date for predictable captured_at
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('captureUTM', () => {
    it('should return null if window is undefined', () => {
      const originalWindow = global.window
      // @ts-expect-error - overriding for test
      delete global.window

      expect(captureUTM()).toBeNull()

      global.window = originalWindow
    })

    it('should capture and store UTM parameters from URL', () => {
      vi.stubGlobal('window', {
        ...window,
        location: {
          search: '?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale',
          pathname: '/pricing'
        }
      })
      vi.stubGlobal('document', {
        ...document,
        referrer: ''
      })

      const data = captureUTM()

      expect(data).toEqual({
        utm_source: 'google',
        utm_medium: 'cpc',
        utm_campaign: 'summer_sale',
        utm_content: null,
        utm_term: null,
        referrer: null,
        landing_page: '/pricing',
        captured_at: '2024-01-01T12:00:00.000Z'
      })

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        UTM_STORAGE_KEY,
        JSON.stringify(data)
      )
    })

    it('should capture and store referrer even if no UTM params exist', () => {
      vi.stubGlobal('window', {
        ...window,
        location: {
          search: '',
          pathname: '/home'
        }
      })
      vi.stubGlobal('document', {
        ...document,
        referrer: 'https://news.ycombinator.com/'
      })

      const data = captureUTM()

      expect(data).toEqual({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
        referrer: 'https://news.ycombinator.com/',
        landing_page: '/home',
        captured_at: '2024-01-01T12:00:00.000Z'
      })

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        UTM_STORAGE_KEY,
        JSON.stringify(data)
      )
    })

    it('should return null and not store if no UTMs and no referrer', () => {
      vi.stubGlobal('window', {
        ...window,
        location: {
          search: '',
          pathname: '/home'
        }
      })
      vi.stubGlobal('document', {
        ...document,
        referrer: ''
      })

      const data = captureUTM()

      expect(data).toBeNull()
      expect(sessionStorage.setItem).not.toHaveBeenCalled()
    })

    it('should return existing data if already captured this session', () => {
      const existingData: UTMData = {
        utm_source: 'twitter',
        utm_medium: 'social',
        utm_campaign: 'launch',
        utm_content: null,
        utm_term: null,
        referrer: null,
        landing_page: '/home',
        captured_at: '2023-12-31T12:00:00.000Z'
      }
      mockStorage[UTM_STORAGE_KEY] = JSON.stringify(existingData)

      // Even if URL has new UTMs
      vi.stubGlobal('window', {
        ...window,
        location: {
          search: '?utm_source=facebook',
          pathname: '/home'
        }
      })

      const data = captureUTM()

      expect(data).toEqual(existingData)
      expect(sessionStorage.setItem).not.toHaveBeenCalled()
    })

    it('should recover if existing stored data is invalid JSON', () => {
      mockStorage[UTM_STORAGE_KEY] = 'invalid-json'

      vi.stubGlobal('window', {
        ...window,
        location: {
          search: '?utm_source=google',
          pathname: '/home'
        }
      })
      vi.stubGlobal('document', {
        ...document,
        referrer: ''
      })

      const data = captureUTM()

      expect(data).toEqual({
        utm_source: 'google',
        utm_medium: null,
        utm_campaign: null,
        utm_content: null,
        utm_term: null,
        referrer: null,
        landing_page: '/home',
        captured_at: '2024-01-01T12:00:00.000Z'
      })

      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        UTM_STORAGE_KEY,
        JSON.stringify(data)
      )
    })
  })

  describe('getUTM', () => {
    it('should return null if window is undefined', () => {
      const originalWindow = global.window
      // @ts-expect-error - overriding for test
      delete global.window

      expect(getUTM()).toBeNull()

      global.window = originalWindow
    })

    it('should retrieve stored UTM data from sessionStorage', () => {
      const storedData: UTMData = {
        utm_source: 'newsletter',
        utm_medium: 'email',
        utm_campaign: 'weekly',
        utm_content: null,
        utm_term: null,
        referrer: null,
        landing_page: '/blog',
        captured_at: '2024-01-01T12:00:00.000Z'
      }
      mockStorage[UTM_STORAGE_KEY] = JSON.stringify(storedData)

      expect(getUTM()).toEqual(storedData)
    })

    it('should return null if nothing stored', () => {
      expect(getUTM()).toBeNull()
    })

    it('should return null if stored data is invalid JSON', () => {
      mockStorage[UTM_STORAGE_KEY] = 'invalid-json'
      expect(getUTM()).toBeNull()
    })
  })

  describe('getUTMMetadata', () => {
    it('should return empty object if no UTM data', () => {
      expect(getUTMMetadata()).toEqual({})
    })

    it('should return flat key-value pairs excluding null fields', () => {
      const storedData: UTMData = {
        utm_source: 'google',
        utm_medium: null,
        utm_campaign: 'summer_sale',
        utm_content: null,
        utm_term: null,
        referrer: 'https://google.com',
        landing_page: '/pricing',
        captured_at: '2024-01-01T12:00:00.000Z'
      }
      mockStorage[UTM_STORAGE_KEY] = JSON.stringify(storedData)

      const metadata = getUTMMetadata()

      expect(metadata).toEqual({
        utm_source: 'google',
        utm_campaign: 'summer_sale',
        referrer: 'https://google.com',
        landing_page: '/pricing'
      })
      expect(metadata).not.toHaveProperty('utm_medium')
      expect(metadata).not.toHaveProperty('utm_content')
      expect(metadata).not.toHaveProperty('utm_term')
      expect(metadata).not.toHaveProperty('captured_at')
    })
  })
})
