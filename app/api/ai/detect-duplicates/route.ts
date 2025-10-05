import { NextRequest, NextResponse } from 'next/server';
import { validateJWTSecret } from '@/lib/config/env';
import OpenAI from 'openai';
import db from '@/lib/db/connection';

// Initialize OpenAI client
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * POST /api/ai/detect-duplicates
 *
 * Detect duplicate or similar tickets using semantic similarity
 * Uses OpenAI embeddings to find tickets with similar content
 */
export async function POST(request: NextRequest) {
  try {
    // Check if AI features are enabled
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI features are not enabled. Please configure OPENAI_API_KEY.',
        },
        { status: 503 }
      );
    }

    if (!openai) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI client not initialized',
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { title, description, tenant_id, threshold = 0.85 } = body;

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        {
          success: false,
          error: 'Title and description are required',
        },
        { status: 400 }
      );
    }

    // Validate threshold
    if (threshold < 0 || threshold > 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Threshold must be between 0 and 1',
        },
        { status: 400 }
      );
    }

    // Combine title and description for embedding
    const queryText = `${title}\n\n${description}`;

    // Generate embedding for the query ticket
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: queryText,
      encoding_format: 'float',
    });

    const queryEmbedding = embeddingResponse.data[0]?.embedding;

    if (!queryEmbedding) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate embedding',
        },
        { status: 500 }
      );
    }

    // Get recent tickets from the same tenant (last 90 days)
    const query = `
      SELECT
        t.id,
        t.title,
        t.description,
        t.status_id,
        t.created_at,
        s.name as status_name,
        u.name as user_name,
        u.email as user_email
      FROM tickets t
      LEFT JOIN statuses s ON t.status_id = s.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE
        t.tenant_id = ?
        AND t.created_at > datetime('now', '-90 days')
        AND s.name NOT IN ('Resolvido', 'Fechado', 'Resolved', 'Closed')
      ORDER BY t.created_at DESC
      LIMIT 100
    `;

    const recentTickets = db.prepare(query).all(tenant_id || 1) as any[];

    // Calculate similarity scores
    const similarities: Array<{
      ticket: any;
      similarity: number;
    }> = [];

    for (const ticket of recentTickets) {
      const ticketText = `${ticket.title}\n\n${ticket.description || ''}`;

      // Generate embedding for the existing ticket
      const ticketEmbeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: ticketText,
        encoding_format: 'float',
      });

      const ticketEmbedding = ticketEmbeddingResponse.data[0]?.embedding;

      if (ticketEmbedding) {
        // Calculate cosine similarity
        const similarity = cosineSimilarity(queryEmbedding, ticketEmbedding);

        if (similarity >= threshold) {
          similarities.push({
            ticket: {
              id: ticket.id,
              title: ticket.title,
              description: ticket.description?.substring(0, 200), // Truncate for response
              status: ticket.status_name,
              created_at: ticket.created_at,
              user_name: ticket.user_name,
              user_email: ticket.user_email,
            },
            similarity: Math.round(similarity * 100) / 100, // Round to 2 decimals
          });
        }
      }
    }

    // Sort by similarity (highest first)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Limit to top 5 matches
    const topMatches = similarities.slice(0, 5);

    // Determine if duplicates were found
    const hasDuplicates = topMatches.length > 0;

    // Generate recommendation based on similarity scores
    let recommendation = 'No similar tickets found.';
    if (topMatches.length > 0) {
      const highestSimilarity = topMatches[0]?.similarity;
      if (highestSimilarity && highestSimilarity >= 0.95) {
        recommendation = 'Strong duplicate detected. Consider closing this ticket as duplicate.';
      } else if (highestSimilarity && highestSimilarity >= 0.85) {
        recommendation = 'Possible duplicate found. Review similar tickets before proceeding.';
      } else {
        recommendation = 'Similar tickets found. May contain relevant information.';
      }
    }

    return NextResponse.json({
      success: true,
      has_duplicates: hasDuplicates,
      duplicate_count: topMatches.length,
      recommendation,
      similar_tickets: topMatches,
      threshold_used: threshold,
    });
  } catch (error: any) {
    console.error('Error detecting duplicates:', error);

    // Handle OpenAI API errors
    if (error?.status === 401) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid OpenAI API key',
        },
        { status: 401 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API rate limit exceeded. Please try again later.',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to detect duplicates',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i] ?? 0;
    const b = vecB[i] ?? 0;
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}
