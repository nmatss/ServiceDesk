/**
 * Knowledge Base Popular Searches API
 * Provides list of popular/trending search queries
 */

import { NextRequest, NextResponse } from 'next/server';
import { semanticSearchEngine } from '@/lib/knowledge/semantic-search';
import { logger } from '@/lib/monitoring/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const days = parseInt(searchParams.get('days') || '30');

    // Get analytics data
    const analytics = semanticSearchEngine.getSearchAnalytics(undefined, days);

    // Return top queries
    return NextResponse.json({
      queries: analytics.topQueries.slice(0, limit).map(q => q.query),
      topQueries: analytics.topQueries.slice(0, limit),
      totalSearches: analytics.totalSearches,
    });
  } catch (error) {
    logger.error('Popular searches error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
