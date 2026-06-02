import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { classifyError, executeAuditRequest, type AuditRequestParams, type AuditRequestCallbacks } from '@/lib/request-engine'

describe('request-engine', () => {
  describe('classifyError', () => {
    it('should classify timeout errors', () => {
      expect(classifyError(new DOMException('Aborted', 'AbortError')).category).toBe('timeout')
      expect(classifyError(new Error('The request timed out')).category).toBe('timeout')
    })

    it('should classify network errors', () => {
      expect(classifyError(new Error('NETWORK_ERROR')).category).toBe('network')
      expect(classifyError(new Error('Failed to fetch')).category).toBe('network')
      expect(classifyError(new Error('NetworkError')).category).toBe('network')
      expect(classifyError(new Error('ERR_CONNECTION_REFUSED')).category).toBe('network')
    })

    it('should classify rate limit errors', () => {
      expect(classifyError(new Error('Rate limit exceeded')).category).toBe('rate_limit')
      expect(classifyError(new Error('HTTP 429 Too Many Requests')).category).toBe('rate_limit')
      expect(classifyError(new Error('quota exceeded')).category).toBe('rate_limit')
    })

    it('should classify invalid URL errors', () => {
      expect(classifyError(new Error('Invalid URL format')).category).toBe('invalid_url')
      expect(classifyError(new Error('Not a valid URL')).category).toBe('invalid_url')
      expect(classifyError(new Error('SSRF detected')).category).toBe('invalid_url')
      expect(classifyError(new Error('Access blocked')).category).toBe('invalid_url')
    })

    it('should classify server errors', () => {
      expect(classifyError(new Error('HTTP 502 Bad Gateway')).category).toBe('server')
      expect(classifyError(new Error('HTTP 503 Service Unavailable')).category).toBe('server')
      expect(classifyError(new Error('HTTP 504 Gateway Timeout')).category).toBe('server')
      expect(classifyError(new Error('Both audit engines failed')).category).toBe('server')
    })

    it('should classify unknown errors', () => {
      expect(classifyError(new Error('Something completely unexpected')).category).toBe('unknown')
      expect(classifyError(null).category).toBe('unknown')
      expect(classifyError(undefined).category).toBe('unknown')
      expect(classifyError({}).category).toBe('unknown')
    })
  })

  describe('executeAuditRequest backoff/retry', () => {
    let mockFetch: any

    beforeEach(() => {
      mockFetch = vi.fn()
      global.fetch = mockFetch
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('should retry on retryable errors and succeed on a subsequent attempt', async () => {
      // Setup mock to fail on first call, succeed on second call
      mockFetch.mockRejectedValueOnce(new Error('NETWORK_ERROR'))
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'success' }),
        status: 200
      })

      const params: AuditRequestParams = { url: 'https://example.com', device: 'mobile', connection: '4g', location: 'us' }
      const callbacks: AuditRequestCallbacks = {
        onStageChange: vi.fn(),
        onRetry: vi.fn()
      }
      const abortController = new AbortController()

      // executeAuditRequest returns a promise. We need to await it and advance timers while it is pending.
      // Because `executeAuditRequest` uses `await new Promise(...)` for the retry wait, we have to
      // advance timers asynchronously.

      const p = executeAuditRequest(params, callbacks, abortController.signal, {
        maxRetries: 2,
        backoffBaseMs: 1000,
        backoffMaxMs: 5000,
        baseTimeout: 10000
      })

      // Wait a tick for the first attempt to fail and the retry timeout to be set
      await Promise.resolve()

      // Fast-forward timers to trigger the retry
      await vi.advanceTimersByTimeAsync(2000)

      const result = await p

      expect(result).toEqual({ data: 'success' })
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(callbacks.onRetry).toHaveBeenCalledWith(1, 2, expect.any(Number))
    })

    it('should throw after max retries are exhausted', async () => {
      // Setup mock to constantly fail with a retryable error
      mockFetch.mockRejectedValue(new Error('NETWORK_ERROR'))

      const params: AuditRequestParams = { url: 'https://example.com/fail', device: 'mobile', connection: '4g', location: 'us' }
      const callbacks: AuditRequestCallbacks = {
        onStageChange: vi.fn(),
        onRetry: vi.fn()
      }
      const abortController = new AbortController()

      // We start the promise but need to explicitly catch it so Vitest doesn't consider it unhandled
      const p = executeAuditRequest(params, callbacks, abortController.signal, {
        maxRetries: 2,
        backoffBaseMs: 100,
        backoffMaxMs: 500,
        baseTimeout: 10000
      }).catch(e => {
        expect(e).toMatchObject({ category: 'network' })
      })

      // Wait a tick for the initial attempt to fail and set the first timeout
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(500)

      // Wait for the first retry attempt to run and fail, and set the second timeout
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(500)

      // Let the final retry run and fail, causing the promise to reject
      await Promise.resolve()

      // Wait for the caught promise to finish
      await p

      expect(mockFetch).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
      expect(callbacks.onRetry).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retryable errors', async () => {
      // Setup mock to fail with a non-retryable error (invalid url)
      mockFetch.mockRejectedValue(new Error('Invalid URL'))

      const params: AuditRequestParams = { url: 'invalid-url', device: 'mobile', connection: '4g', location: 'us' }
      const callbacks: AuditRequestCallbacks = {
        onStageChange: vi.fn(),
        onRetry: vi.fn()
      }
      const abortController = new AbortController()

      const p = executeAuditRequest(params, callbacks, abortController.signal, {
        maxRetries: 2,
        baseTimeout: 10000
      })

      await expect(p).rejects.toMatchObject({ category: 'invalid_url' })

      // Should not wait or retry
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(callbacks.onRetry).not.toHaveBeenCalled()
    })
  })
})
