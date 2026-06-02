import { describe, it, expect } from 'vitest'
import {
  buildAuditContext,
  getConnectionProfile,
  getLocationProfile,
  getAdjustedTimeouts,
  rateMetric,
  getRegionalInsights
} from '../lib/audit-context'

describe('Audit Context', () => {
  describe('getConnectionProfile', () => {
    it('returns the correct profile for a known label', () => {
      const profile = getConnectionProfile('3G')
      expect(profile.id).toBe('3g')
      expect(profile.label).toBe('3G')
      expect(profile.timeoutMultiplier).toBe(1.5)
    })

    it('returns the default profile (4G Fast) for an unknown label', () => {
      const profile = getConnectionProfile('Unknown Connection')
      expect(profile.id).toBe('4g-fast')
      expect(profile.label).toBe('4G (Fast)')
      expect(profile.timeoutMultiplier).toBe(1.0)
    })
  })

  describe('buildAuditContext', () => {
    it('creates a full audit context', () => {
      const ctx = buildAuditContext('mobile', '3G', 'Asia (Singapore)')

      expect(ctx.strategy).toBe('mobile')

      expect(ctx.connection.id).toBe('3g')
      expect(ctx.connection.label).toBe('3G')
      expect(ctx.connection.timeoutMultiplier).toBe(1.5)

      expect(ctx.location.id).toBe('asia-sg')
      expect(ctx.location.label).toBe('Asia (Singapore)')
      expect(ctx.location.ttfbAdjustMs).toBe(160)
    })

    it('falls back to defaults for unknown inputs', () => {
      const ctx = buildAuditContext('desktop', 'invalid-connection', 'invalid-location')

      expect(ctx.strategy).toBe('desktop')

      expect(ctx.connection.id).toBe('4g-fast') // default connection
      expect(ctx.location.id).toBe('us-east')  // default location
    })
  })

  describe('getAdjustedTimeouts', () => {
    it('scales timeouts by 1.0 for Fast 4G', () => {
      const ctx = buildAuditContext('mobile', '4G (Fast)', 'US East (Virginia)')
      const timeouts = getAdjustedTimeouts(ctx)
      expect(timeouts.psiTimeout).toBe(90000)
      expect(timeouts.psiLiteTimeout).toBe(45000)
      expect(timeouts.customAuditTimeout).toBe(60000)
    })

    it('scales timeouts by 1.5 for 3G', () => {
      const ctx = buildAuditContext('mobile', '3G', 'US East (Virginia)')
      const timeouts = getAdjustedTimeouts(ctx)
      expect(timeouts.psiTimeout).toBe(90000 * 1.5)
      expect(timeouts.psiLiteTimeout).toBe(45000 * 1.5)
      expect(timeouts.customAuditTimeout).toBe(60000 * 1.5)
    })

    it('scales timeouts by 0.9 for Cable', () => {
      const ctx = buildAuditContext('mobile', 'Cable', 'US East (Virginia)')
      const timeouts = getAdjustedTimeouts(ctx)
      expect(timeouts.psiTimeout).toBe(90000 * 0.9)
      expect(timeouts.psiLiteTimeout).toBe(45000 * 0.9)
      expect(timeouts.customAuditTimeout).toBe(60000 * 0.9)
    })
  })

  describe('rateMetric', () => {
    it('rates LCP correctly with US East latency', () => {
      // 4G Fast LCP thresholds: Good <= 2500, Poor >= 4000
      // US East ttfbAdjustMs: 0
      const ctx = buildAuditContext('mobile', '4G (Fast)', 'US East (Virginia)')

      expect(rateMetric('lcp', 2000, ctx)).toBe('good')
      expect(rateMetric('lcp', 3000, ctx)).toBe('needs-improvement')
      expect(rateMetric('lcp', 4500, ctx)).toBe('poor')
    })

    it('rates LCP correctly with AU Sydney latency adjustment', () => {
      // 4G Fast LCP thresholds: Good <= 2500, Poor >= 4000
      // AU Sydney ttfbAdjustMs: 200
      // Adjusted thresholds: Good <= 2700, Poor >= 4200
      const ctx = buildAuditContext('mobile', '4G (Fast)', 'AU (Sydney)')

      expect(rateMetric('lcp', 2600, ctx)).toBe('good') // Would be needs-improvement without latency adjustment
      expect(rateMetric('lcp', 4100, ctx)).toBe('needs-improvement') // Would be poor without latency adjustment
      expect(rateMetric('lcp', 4500, ctx)).toBe('poor')
    })

    it('rates TBT correctly without latency adjustment', () => {
      // 4G Fast TBT thresholds: Good <= 200, Poor >= 600 (200 * 3)
      // TBT does not get latency adjustments
      const ctx = buildAuditContext('mobile', '4G (Fast)', 'AU (Sydney)')

      expect(rateMetric('tbt', 100, ctx)).toBe('good')
      expect(rateMetric('tbt', 300, ctx)).toBe('needs-improvement')
      expect(rateMetric('tbt', 700, ctx)).toBe('poor')
    })

    it('returns needs-improvement for unknown metric', () => {
      const ctx = buildAuditContext('mobile', '4G (Fast)', 'US East (Virginia)')
      // @ts-expect-error - Testing invalid input
      expect(rateMetric('unknown', 100, ctx)).toBe('needs-improvement')
    })
  })

  describe('getRegionalInsights', () => {
    it('returns insights based on location latency', () => {
      const ctx = buildAuditContext('mobile', '4G (Fast)', 'EU West (London)')
      const insights = getRegionalInsights(ctx)

      expect(insights.length).toBeGreaterThan(0)
      expect(insights.some(i => i.includes('~70ms additional latency'))).toBe(true)
      expect(insights.some(i => i.includes('Total expected RTT: ~130ms'))).toBe(true) // 50ms (4G fast RTT) + 80ms (EU West baseline)
    })

    it('returns insights based on low throughput connections', () => {
      const ctx = buildAuditContext('mobile', '3G', 'US East (Virginia)')
      const insights = getRegionalInsights(ctx)

      expect(insights.length).toBeGreaterThan(0)
      expect(insights.some(i => i.includes('1.5 Mbps'))).toBe(true)
      expect(insights.some(i => i.includes('Prioritize code-splitting'))).toBe(true)
    })

    it('includes TTFB context when provided and latency is adjusted', () => {
      const ctx = buildAuditContext('mobile', '4G (Fast)', 'AU (Sydney)')
      const insights = getRegionalInsights(ctx, 300)

      // Should mention adjusted TTFB of 500 (300 base + 200 AU Sydney adjustment)
      expect(insights.some(i => i.includes('Estimated TTFB for AU (Sydney) users: ~500ms'))).toBe(true)
    })

    it('returns empty insights for fast connection and baseline location without TTFB', () => {
      const ctx = buildAuditContext('mobile', 'Cable', 'US East (Virginia)')
      const insights = getRegionalInsights(ctx)

      expect(insights.length).toBe(0)
    })
  })

  describe('getLocationProfile', () => {
    it('returns the correct profile for a known label', () => {
      const profile = getLocationProfile('EU West (London)')
      expect(profile.id).toBe('eu-west')
      expect(profile.label).toBe('EU West (London)')
      expect(profile.region).toBe('EU')
    })

    it('returns the default profile (US East) for an unknown label', () => {
      const profile = getLocationProfile('Unknown Location')
      expect(profile.id).toBe('us-east')
      expect(profile.label).toBe('US East (Virginia)')
      expect(profile.region).toBe('NA')
    })
  })
})
