import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePdfReport } from '@/lib/pdf-export'
import type { AuditResult } from '@/app/dashboard/types'

const mockText = vi.fn()
const mockSave = vi.fn()
const mockAddPage = vi.fn()
const mockSetFillColor = vi.fn()
const mockSetTextColor = vi.fn()
const mockSetFontSize = vi.fn()
const mockSetFont = vi.fn()
const mockRect = vi.fn()
const mockRoundedRect = vi.fn()

vi.mock('jspdf', () => {
  return {
    jsPDF: class {
      internal = {
        pageSize: {
          getWidth: () => 210, // A4 width in mm
          getHeight: () => 297, // A4 height in mm
        },
      }
      text = mockText
      save = mockSave
      addPage = mockAddPage
      setFillColor = mockSetFillColor
      setTextColor = mockSetTextColor
      setFontSize = mockSetFontSize
      setFont = mockSetFont
      rect = mockRect
      roundedRect = mockRoundedRect
    },
  }
})

describe('generatePdfReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const baseResult: AuditResult = {
    url: 'https://example.com',
    strategy: 'desktop',
    fetchedAt: '2023-10-27T10:00:00.000Z',
    scores: null,
    cwv: null,
    fieldData: null,
    opportunities: [],
    diagnostics: [],
  }

  it('generates a basic PDF and saves with correct filename', () => {
    generatePdfReport(baseResult)
    expect(mockSave).toHaveBeenCalledWith('vitalfix-report-example-com-2023-10-27.pdf')
    expect(mockText).toHaveBeenCalledWith('VitalFix', expect.any(Number), expect.any(Number))
  })

  it('renders full content when all metrics are available', () => {
    const fullResult: AuditResult = {
      ...baseResult,
      healthScore: 85,
      scores: {
        performance: 90,
        accessibility: 80,
        bestPractices: 100,
        seo: 70,
      },
      cwv: {
        lcp: { value: '2.5s', score: 0.9 },
        inp: { value: '200ms', score: 0.8 },
        cls: { value: '0.1', score: 0.95 },
        fcp: { value: '1.0s', score: 0.9 },
        ttfb: { value: '0.5s', score: 0.9 },
        si: { value: '3.0s', score: 0.9 },
        tbt: { value: '150ms', score: 0.9 },
      },
      fieldData: {
        lcp: { p75: 2500, category: 'AVERAGE' },
        inp: { p75: 200, category: 'AVERAGE' },
        cls: { p75: 0.1, category: 'FAST' },
        fid: { p75: 10, category: 'FAST' },
        overallCategory: 'AVERAGE',
      },
      customAudit: {
        url: 'https://example.com',
        fetchedAt: '2023-10-27T10:00:00.000Z',
        duration: 1000,
        overallScore: 88,
        totalFindings: 5,
        critical: 1,
        moderate: 2,
        minor: 2,
        categories: [
          { category: 'seo', label: 'SEO', score: 90, passed: 10, failed: 1, findings: [] },
        ],
      },
      opportunities: [
        { id: '1', title: 'Optimize images', description: 'desc', score: 0.5, displayValue: '1.2s', impact: 'high' },
      ],
    }

    generatePdfReport(fullResult)

    // Verify some specific texts are rendered
    expect(mockText).toHaveBeenCalledWith('Performance', expect.any(Number), expect.any(Number), expect.any(Object))
    expect(mockText).toHaveBeenCalledWith('Core Web Vitals', expect.any(Number), expect.any(Number))
    expect(mockText).toHaveBeenCalledWith('Real User Experience (CrUX)', expect.any(Number), expect.any(Number))
    expect(mockText).toHaveBeenCalledWith('Top Opportunities', expect.any(Number), expect.any(Number))
    expect(mockText).toHaveBeenCalledWith('Site Audit Breakdown', expect.any(Number), expect.any(Number))
  })

  it('truncates very long URLs', () => {
    const longUrlResult: AuditResult = {
      ...baseResult,
      url: 'https://www.this-is-a-very-very-very-very-very-very-very-very-very-very-long-url.com/some/path/that/keeps/going',
    }
    generatePdfReport(longUrlResult)
    const expectedUrl = longUrlResult.url.slice(0, 67) + '...'
    expect(mockText).toHaveBeenCalledWith(expectedUrl, expect.any(Number), expect.any(Number))
  })

  it('adds a new page if content exceeds height', () => {
      // The breakdown section has logic: if (y > 240) { doc.addPage(); y = margin; }
      // The breakdown section is triggered by customAudit.categories
      // To push y > 240, we need lots of other content first like scores, cwv, fieldData, and opportunities
      const opportunities = Array.from({ length: 8 }).map((_, i) => ({
          id: String(i),
          title: `Opportunity ${i}`,
          description: 'desc',
          score: 0.5,
          displayValue: '1.2s',
          impact: 'high'
      }))

      const resultWithLotsOfContent: AuditResult = {
          ...baseResult,
          scores: { performance: 90, accessibility: 80, bestPractices: 100, seo: 70 },
          cwv: {
            lcp: { value: '2.5s', score: 0.9 },
            inp: { value: '200ms', score: 0.8 },
            cls: { value: '0.1', score: 0.95 },
            fcp: { value: '1.0s', score: 0.9 },
            ttfb: { value: '0.5s', score: 0.9 },
            si: { value: '3.0s', score: 0.9 },
            tbt: { value: '150ms', score: 0.9 },
          },
          fieldData: {
            lcp: { p75: 2500, category: 'AVERAGE' },
            inp: { p75: 200, category: 'AVERAGE' },
            cls: { p75: 0.1, category: 'FAST' },
            fid: { p75: 10, category: 'FAST' },
            overallCategory: 'AVERAGE',
          },
          customAudit: {
              url: 'https://example.com',
              fetchedAt: '2023-10-27T10:00:00.000Z',
              duration: 1000,
              overallScore: 88,
              totalFindings: 5,
              critical: 1,
              moderate: 2,
              minor: 2,
              categories: [
                  { category: 'seo', label: 'SEO', score: 90, passed: 10, failed: 1, findings: [] },
              ],
          },
          opportunities
      }

      generatePdfReport(resultWithLotsOfContent)
      expect(mockAddPage).toHaveBeenCalled()
  })
})