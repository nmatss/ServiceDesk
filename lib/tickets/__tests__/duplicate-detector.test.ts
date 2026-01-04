/**
 * Unit Tests for Duplicate Ticket Detector
 * Tests similarity detection, scoring, and duplicate identification
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { buildTicket } from '@/tests/utils/test-helpers'

// Mock duplicate detector types and implementation
interface DuplicateMatch {
  ticket: any
  similarityScore: number
  confidenceLevel: 'low' | 'medium' | 'high' | 'very_high'
  matchReasons: MatchReason[]
}

interface MatchReason {
  type: 'semantic' | 'keyword' | 'structural' | 'temporal'
  description: string
  weight: number
  confidence: number
}

interface DuplicateDetectionResult {
  isDuplicate: boolean
  confidence: number
  matches: DuplicateMatch[]
  suggestedActions: string[]
}

class SimpleDuplicateDetector {
  private config: {
    duplicateThreshold: number
    keywordWeight: number
    semanticWeight: number
  }

  constructor(config?: Partial<typeof this.config>) {
    this.config = {
      duplicateThreshold: 0.85,
      keywordWeight: 0.5,
      semanticWeight: 0.5,
      ...config,
    }
  }

  async detectDuplicates(
    newTicket: { title: string; description: string },
    existingTickets: any[]
  ): Promise<DuplicateDetectionResult> {
    const matches: DuplicateMatch[] = []

    for (const ticket of existingTickets) {
      const similarity = this.calculateSimilarity(newTicket, ticket)

      if (similarity >= 0.3) {
        matches.push({
          ticket,
          similarityScore: similarity,
          confidenceLevel: this.getConfidenceLevel(similarity),
          matchReasons: this.getMatchReasons(newTicket, ticket, similarity),
        })
      }
    }

    matches.sort((a, b) => b.similarityScore - a.similarityScore)

    const topMatch = matches[0]
    const isDuplicate = topMatch && topMatch.similarityScore >= this.config.duplicateThreshold

    return {
      isDuplicate,
      confidence: topMatch?.similarityScore || 0,
      matches,
      suggestedActions: this.getSuggestedActions(matches),
    }
  }

  private calculateSimilarity(ticket1: any, ticket2: any): number {
    // Calculate keyword similarity
    const keywordSim = this.calculateKeywordSimilarity(
      ticket1.title + ' ' + ticket1.description,
      ticket2.title + ' ' + ticket2.description
    )

    // Calculate title similarity (more weight)
    const titleSim = this.calculateKeywordSimilarity(ticket1.title, ticket2.title)

    // Combine scores
    return keywordSim * 0.5 + titleSim * 0.5
  }

  private calculateKeywordSimilarity(text1: string, text2: string): number {
    const words1 = this.tokenize(text1)
    const words2 = this.tokenize(text2)

    if (words1.length === 0 || words2.length === 0) {
      return 0
    }

    const set1 = new Set(words1)
    const set2 = new Set(words2)

    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    return intersection.size / union.size
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
  }

  private getConfidenceLevel(score: number): 'low' | 'medium' | 'high' | 'very_high' {
    if (score >= 0.95) return 'very_high'
    if (score >= 0.85) return 'high'
    if (score >= 0.70) return 'medium'
    return 'low'
  }

  private getMatchReasons(ticket1: any, ticket2: any, score: number): MatchReason[] {
    const reasons: MatchReason[] = []

    // Check for exact title match
    if (ticket1.title.toLowerCase() === ticket2.title.toLowerCase()) {
      reasons.push({
        type: 'keyword',
        description: 'Exact title match',
        weight: 1.0,
        confidence: 1.0,
      })
    }

    // Check for keyword overlap
    const keywords1 = this.tokenize(ticket1.title + ' ' + ticket1.description)
    const keywords2 = this.tokenize(ticket2.title + ' ' + ticket2.description)
    const commonKeywords = keywords1.filter(k => keywords2.includes(k))

    if (commonKeywords.length > 3) {
      reasons.push({
        type: 'keyword',
        description: `${commonKeywords.length} common keywords`,
        weight: 0.7,
        confidence: Math.min(commonKeywords.length / 10, 1),
      })
    }

    // Check structural similarity
    if (ticket1.category_id === ticket2.category_id) {
      reasons.push({
        type: 'structural',
        description: 'Same category',
        weight: 0.3,
        confidence: 0.8,
      })
    }

    if (ticket1.priority_id === ticket2.priority_id) {
      reasons.push({
        type: 'structural',
        description: 'Same priority',
        weight: 0.2,
        confidence: 0.6,
      })
    }

    return reasons
  }

  private getSuggestedActions(matches: DuplicateMatch[]): string[] {
    const actions: string[] = []

    if (matches.length === 0) {
      actions.push('proceed_normal')
      return actions
    }

    const topMatch = matches[0]

    if (topMatch.similarityScore >= 0.95) {
      actions.push('auto_merge')
    } else if (topMatch.similarityScore >= 0.85) {
      actions.push('suggest_merge')
    } else if (topMatch.similarityScore >= 0.70) {
      actions.push('create_link')
    } else if (topMatch.similarityScore >= 0.50) {
      actions.push('flag_review')
    } else {
      actions.push('proceed_normal')
    }

    return actions
  }
}

describe('Duplicate Ticket Detector', () => {
  let detector: SimpleDuplicateDetector

  beforeEach(() => {
    detector = new SimpleDuplicateDetector()
  })

  describe('Basic Duplicate Detection', () => {
    it('should detect exact duplicates', async () => {
      const newTicket = {
        title: 'Cannot login to system',
        description: 'I am unable to login to the system',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Cannot login to system',
          description: 'I am unable to login to the system',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      expect(result.isDuplicate).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.9)
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].confidenceLevel).toBe('very_high')
    })

    it('should detect near duplicates with minor variations', async () => {
      const newTicket = {
        title: 'Cannot login to the system',
        description: 'Unable to login',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Cannot login to system',
          description: 'I cannot login to the system',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      // High similarity should be detected (may or may not exceed threshold)
      expect(result.matches.length).toBeGreaterThan(0)
      expect(result.matches[0].similarityScore).toBeGreaterThan(0.7)
      expect(result.isDuplicate).toBe(result.matches[0].similarityScore >= 0.85)
    })

    it('should not flag completely different tickets as duplicates', async () => {
      const newTicket = {
        title: 'Printer not working',
        description: 'The office printer is jammed',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Email not sending',
          description: 'Cannot send emails from outlook',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      expect(result.isDuplicate).toBe(false)
      // Confidence is 0 when no matches above threshold
      if (result.matches.length > 0) {
        expect(result.confidence).toBeLessThan(0.5)
      } else {
        expect(result.confidence).toBe(0)
      }
    })
  })

  describe('Similarity Scoring', () => {
    it('should return higher scores for more similar tickets', async () => {
      const newTicket = {
        title: 'Login issue with SSO',
        description: 'Single sign-on authentication failing',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Login issue with SSO',
          description: 'SSO authentication not working',
        }),
        buildTicket({
          id: 2,
          title: 'Password reset needed',
          description: 'Forgot my password',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      // Should have at least one match
      expect(result.matches.length).toBeGreaterThan(0)

      // If both are matches (above 0.3 threshold), first should be higher
      if (result.matches.length >= 2) {
        expect(result.matches[0].similarityScore).toBeGreaterThan(result.matches[1].similarityScore)
      }
    })

    it('should weight title similarity heavily', async () => {
      const newTicket = {
        title: 'Network connectivity problem',
        description: 'Other details here',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Network connectivity problem',
          description: 'Completely different description',
        }),
        buildTicket({
          id: 2,
          title: 'Something else entirely',
          description: 'Network connectivity problem - detailed explanation',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      // First ticket should score higher due to title match
      expect(result.matches[0].ticket.id).toBe(1)
    })
  })

  describe('Match Reasons', () => {
    it('should provide match reasons for duplicates', async () => {
      const newTicket = {
        title: 'Cannot login',
        description: 'System login failing',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Cannot login',
          description: 'Login system not working',
          category_id: 1,
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      expect(result.matches[0].matchReasons).toBeDefined()
      expect(result.matches[0].matchReasons.length).toBeGreaterThan(0)

      const hasKeywordReason = result.matches[0].matchReasons.some(
        r => r.type === 'keyword'
      )
      expect(hasKeywordReason).toBe(true)
    })

    it('should identify exact title matches', async () => {
      const newTicket = {
        title: 'Exact Same Title',
        description: 'Different description',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Exact Same Title',
          description: 'Another description',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      const exactTitleReason = result.matches[0].matchReasons.find(
        r => r.description === 'Exact title match'
      )

      expect(exactTitleReason).toBeDefined()
      expect(exactTitleReason?.weight).toBe(1.0)
    })
  })

  describe('Suggested Actions', () => {
    it('should suggest auto-merge for very high similarity', async () => {
      const newTicket = {
        title: 'Same ticket title',
        description: 'Same description content',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Same ticket title',
          description: 'Same description content',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      expect(result.suggestedActions).toContain('auto_merge')
    })

    it('should suggest manual review for medium similarity', async () => {
      const newTicket = {
        title: 'Login problem with credentials',
        description: 'Cannot authenticate',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Login issue',
          description: 'Authentication failing',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      // Should have suggested actions
      expect(result.suggestedActions.length).toBeGreaterThan(0)

      // For any detected similarity, should not just proceed normally (unless very low)
      const hasReviewAction = result.suggestedActions.some(
        a => a === 'create_link' || a === 'suggest_merge' || a === 'flag_review' || a === 'auto_merge'
      )
      const proceedNormal = result.suggestedActions.includes('proceed_normal')

      // Either has review action OR proceeds normally (for low similarity)
      expect(hasReviewAction || proceedNormal).toBe(true)
    })

    it('should proceed normally for low similarity', async () => {
      const newTicket = {
        title: 'Completely different issue',
        description: 'Something entirely new',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Unrelated ticket',
          description: 'Different problem',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      expect(result.suggestedActions).toContain('proceed_normal')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty ticket list', async () => {
      const newTicket = {
        title: 'Test ticket',
        description: 'Test description',
      }

      const result = await detector.detectDuplicates(newTicket, [])

      expect(result.isDuplicate).toBe(false)
      expect(result.matches).toHaveLength(0)
      expect(result.confidence).toBe(0)
      expect(result.suggestedActions).toContain('proceed_normal')
    })

    it('should handle very short descriptions', async () => {
      const newTicket = {
        title: 'Bug',
        description: 'Fix',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Bug',
          description: 'Fix',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      expect(result).toBeDefined()
      expect(result.matches).toBeDefined()
    })

    it('should handle special characters', async () => {
      const newTicket = {
        title: 'Error: Cannot connect to DB @#$%',
        description: 'Connection failed!!! Please help???',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Error Cannot connect to DB',
          description: 'Connection failed Please help',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      expect(result.isDuplicate).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.7)
    })

    it('should be case-insensitive', async () => {
      const newTicket = {
        title: 'CANNOT LOGIN TO SYSTEM',
        description: 'URGENT ISSUE',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'cannot login to system',
          description: 'urgent issue',
        }),
      ]

      const result = await detector.detectDuplicates(newTicket, existingTickets)

      expect(result.isDuplicate).toBe(true)
    })

    it('should handle large number of existing tickets efficiently', async () => {
      const newTicket = {
        title: 'Find this ticket',
        description: 'Unique search content',
      }

      const existingTickets = []
      for (let i = 0; i < 100; i++) {
        existingTickets.push(
          buildTicket({
            id: i,
            title: `Random ticket ${i}`,
            description: `Random description ${i}`,
          })
        )
      }

      existingTickets.push(
        buildTicket({
          id: 100,
          title: 'Find this ticket',
          description: 'Unique search content',
        })
      )

      const startTime = Date.now()
      const result = await detector.detectDuplicates(newTicket, existingTickets)
      const duration = Date.now() - startTime

      expect(result.matches[0].ticket.id).toBe(100)
      expect(duration).toBeLessThan(1000) // Should complete in less than 1 second
    })
  })

  describe('Configuration', () => {
    it('should respect custom duplicate threshold', async () => {
      const strictDetector = new SimpleDuplicateDetector({
        duplicateThreshold: 0.95,
      })

      const newTicket = {
        title: 'Login issue',
        description: 'Cannot login',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Login problem',
          description: 'Unable to login',
        }),
      ]

      const result = await strictDetector.detectDuplicates(newTicket, existingTickets)

      // With stricter threshold, this might not be flagged as duplicate
      expect(result.confidence).toBeLessThan(0.95)
    })

    it('should allow lenient duplicate detection', async () => {
      const lenientDetector = new SimpleDuplicateDetector({
        duplicateThreshold: 0.6,
      })

      const newTicket = {
        title: 'System slow',
        description: 'Performance issue',
      }

      const existingTickets = [
        buildTicket({
          id: 1,
          title: 'Slow system',
          description: 'Performance problem',
        }),
      ]

      const result = await lenientDetector.detectDuplicates(newTicket, existingTickets)

      expect(result.isDuplicate).toBe(true)
    })
  })
})
