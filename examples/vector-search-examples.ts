/**
 * Vector Search System - Usage Examples
 *
 * This file demonstrates how to use the vector search system
 * in different scenarios.
 */

import { VectorDatabase, HybridSearchEngine, EmbeddingUtils } from '@/lib/ai';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';

// Initialize database and vector search
async function setupVectorSearch() {
  const database = await open({
    filename: './servicedesk.db',
    driver: sqlite3.Database
  });

  const vectorDb = new VectorDatabase(database);
  const hybridSearch = new HybridSearchEngine(vectorDb);

  return { vectorDb, hybridSearch };
}

// Example 1: Generate embeddings for a new ticket
async function example1_GenerateEmbedding() {
  console.log('Example 1: Generate Embedding for New Ticket');
  console.log('='.repeat(50));

  const { vectorDb } = await setupVectorSearch();

  const ticketId = 123;
  const title = 'Cannot access email on mobile device';
  const description = 'I am unable to login to my email account on my iPhone. Keep getting authentication errors.';

  // Prepare content
  const content = EmbeddingUtils.prepareTicketContent(title, description);

  // Check quality
  const quality = EmbeddingUtils.analyzeEmbeddingQuality(content);
  console.log('Quality:', quality);

  if (quality.hasSubstantiveContent) {
    // Generate embedding
    const result = await vectorDb.generateAndStoreEmbedding(
      'ticket',
      ticketId,
      content
    );

    console.log('Embedding generated:', result);
    console.log(`Processing time: ${result.processingTimeMs}ms`);
    console.log(`Cached: ${result.cached}`);
  }
}

// Example 2: Batch generate embeddings
async function example2_BatchGeneration() {
  console.log('\nExample 2: Batch Generate Embeddings');
  console.log('='.repeat(50));

  const { vectorDb } = await setupVectorSearch();

  // Auto-generate embeddings for entities needing them
  const result = await EmbeddingUtils.autoGenerateEmbeddings(vectorDb, {
    entityTypes: ['ticket', 'kb_article'],
    olderThanHours: 24,
    batchSize: 20,
    priority: 5
  });

  console.log('Batch processing result:', result);
  console.log(`Total: ${result.total}`);
  console.log(`Successful: ${result.successful}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Processing time: ${result.processingTimeMs}ms`);

  if (result.errors.length > 0) {
    console.log('Errors:', result.errors);
  }
}

// Example 3: Semantic search
async function example3_SemanticSearch() {
  console.log('\nExample 3: Semantic Search');
  console.log('='.repeat(50));

  const { vectorDb } = await setupVectorSearch();

  const results = await vectorDb.searchSimilar(
    'How do I reset my password?',
    {
      entityTypes: ['ticket', 'kb_article'],
      maxResults: 5,
      threshold: 0.75,
      includeMetadata: true,
      useCache: true
    }
  );

  console.log(`Found ${results.length} similar results:`);
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.entityType} #${result.entityId}`);
    console.log(`   Similarity: ${(result.similarityScore * 100).toFixed(1)}%`);
    console.log(`   Content: ${result.content}`);
    if (result.metadata) {
      console.log(`   Metadata:`, result.metadata);
    }
  });
}

// Example 4: Hybrid search
async function example4_HybridSearch() {
  console.log('\nExample 4: Hybrid Search');
  console.log('='.repeat(50));

  const { hybridSearch } = await setupVectorSearch();

  const results = await hybridSearch.search({
    query: 'email configuration problems',
    entityTypes: ['ticket', 'kb_article'],
    semanticWeight: 0.7,
    keywordWeight: 0.3,
    maxResults: 10,
    threshold: 0.6,
    includeFacets: true,
    filters: {
      // Add any additional filters
      categories: [1, 2, 3],
      dateFrom: '2024-01-01'
    }
  });

  console.log(`Found ${results.total} results in ${results.processingTimeMs}ms`);

  console.log('\nTop results:');
  results.results.slice(0, 5).forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.title}`);
    console.log(`   Type: ${result.type}`);
    console.log(`   Combined Score: ${(result.score * 100).toFixed(1)}%`);
    console.log(`   Semantic: ${((result.semanticScore || 0) * 100).toFixed(1)}%`);
    console.log(`   Keyword: ${((result.keywordScore || 0) * 100).toFixed(1)}%`);
  });

  if (results.facets) {
    console.log('\nFacets:');
    results.facets.forEach(facet => {
      console.log(`\n${facet.field}:`);
      facet.values.slice(0, 5).forEach(value => {
        console.log(`  - ${value.value}: ${value.count}`);
      });
    });
  }

  if (results.suggestions) {
    console.log('\nSuggestions:', results.suggestions);
  }
}

// Example 5: Auto-complete
async function example5_AutoComplete() {
  console.log('\nExample 5: Auto-Complete');
  console.log('='.repeat(50));

  const { hybridSearch } = await setupVectorSearch();

  const result = await hybridSearch.autoComplete({
    query: 'pass',
    limit: 5,
    entityTypes: ['ticket', 'kb_article'],
    includeHistory: true
  });

  console.log('Suggestions:');
  result.suggestions.forEach((suggestion, index) => {
    console.log(`  ${index + 1}. ${suggestion}`);
  });

  console.log('\nMatching entities:');
  result.entities.forEach((entity, index) => {
    console.log(`  ${index + 1}. [${entity.type}] ${entity.title}`);
    console.log(`      Relevance: ${(entity.relevance * 100).toFixed(1)}%`);
  });
}

// Example 6: Find similar tickets (duplicate detection)
async function example6_DuplicateDetection() {
  console.log('\nExample 6: Duplicate Detection');
  console.log('='.repeat(50));

  const { vectorDb } = await setupVectorSearch();

  const title = 'Cannot login to email';
  const description = 'Getting authentication error when trying to access email';

  const duplicates = await vectorDb.findSimilarTickets(
    title,
    description,
    undefined, // Don't exclude any ticket
    5 // Find top 5 similar
  );

  console.log(`Found ${duplicates.length} potentially duplicate tickets:`);
  duplicates.forEach((dup, index) => {
    console.log(`\n${index + 1}. Ticket #${dup.entityId}`);
    console.log(`   Similarity: ${(dup.similarityScore * 100).toFixed(1)}%`);
    console.log(`   Title: ${dup.content}`);
    if (dup.metadata) {
      console.log(`   Status: ${dup.metadata.status}`);
      console.log(`   Priority: ${dup.metadata.priority}`);
      console.log(`   Created: ${dup.metadata.createdAt}`);
    }
  });
}

// Example 7: Find related knowledge base articles
async function example7_RelatedArticles() {
  console.log('\nExample 7: Related Knowledge Base Articles');
  console.log('='.repeat(50));

  const { vectorDb } = await setupVectorSearch();

  const ticketContent = 'I forgot my password and cannot access my account';

  const articles = await vectorDb.findRelatedKnowledgeArticles(
    ticketContent,
    5 // Max 5 articles
  );

  console.log(`Found ${articles.length} related KB articles:`);
  articles.forEach((article, index) => {
    console.log(`\n${index + 1}. ${article.content}`);
    console.log(`   Relevance: ${(article.similarityScore * 100).toFixed(1)}%`);
    if (article.metadata) {
      console.log(`   Summary: ${article.metadata.summary}`);
    }
  });
}

// Example 8: Get system statistics
async function example8_Statistics() {
  console.log('\nExample 8: System Statistics');
  console.log('='.repeat(50));

  const { vectorDb } = await setupVectorSearch();

  // Embedding stats
  const stats = await vectorDb.getStats();
  console.log('Embedding Statistics:');
  console.log(`  Total embeddings: ${stats.totalEmbeddings}`);
  console.log('  By type:', stats.embeddingsByType);
  console.log(`  Average dimension: ${stats.averageVectorDimension}`);
  console.log(`  Oldest: ${stats.oldestEmbedding}`);
  console.log(`  Newest: ${stats.newestEmbedding}`);

  // Cache stats
  const cacheStats = vectorDb.getCacheStats();
  console.log('\nCache Statistics:');
  console.log('  Embeddings cache:');
  console.log(`    Size: ${cacheStats.embeddings.size}/${cacheStats.embeddings.maxSize}`);
  console.log('  Searches cache:');
  console.log(`    Size: ${cacheStats.searches.size}/${cacheStats.searches.maxSize}`);
}

// Example 9: Update embedding when content changes
async function example9_UpdateOnChange() {
  console.log('\nExample 9: Update Embedding on Content Change');
  console.log('='.repeat(50));

  const { vectorDb } = await setupVectorSearch();

  const ticketId = 123;
  const entityType = 'ticket';

  // This would typically be called from a ticket update handler
  const success = await EmbeddingUtils.updateEmbeddingOnChange(
    vectorDb,
    entityType,
    ticketId
  );

  if (success) {
    console.log(`Embedding updated successfully for ${entityType} #${ticketId}`);
  } else {
    console.log(`Failed to update embedding for ${entityType} #${ticketId}`);
  }
}

// Example 10: Weighted hybrid search comparison
async function example10_WeightComparison() {
  console.log('\nExample 10: Compare Different Search Weights');
  console.log('='.repeat(50));

  const { hybridSearch } = await setupVectorSearch();
  const query = 'email configuration';

  // Test different weight configurations
  const configurations = [
    { semantic: 1.0, keyword: 0.0, name: 'Pure Semantic' },
    { semantic: 0.7, keyword: 0.3, name: 'Semantic Heavy' },
    { semantic: 0.5, keyword: 0.5, name: 'Balanced' },
    { semantic: 0.3, keyword: 0.7, name: 'Keyword Heavy' },
    { semantic: 0.0, keyword: 1.0, name: 'Pure Keyword' }
  ];

  for (const config of configurations) {
    const results = await hybridSearch.search({
      query,
      entityTypes: ['ticket', 'kb_article'],
      semanticWeight: config.semantic,
      keywordWeight: config.keyword,
      maxResults: 3
    });

    console.log(`\n${config.name} (${config.semantic}/${config.keyword}):`);
    console.log(`  Found ${results.total} results in ${results.processingTimeMs}ms`);

    if (results.results.length > 0) {
      const avgScore = results.results.reduce((sum, r) => sum + r.score, 0) / results.results.length;
      console.log(`  Average score: ${(avgScore * 100).toFixed(1)}%`);
      console.log(`  Top result: ${results.results[0].title} (${(results.results[0].score * 100).toFixed(1)}%)`);
    }
  }
}

// Run all examples
async function runAllExamples() {
  console.log('VECTOR SEARCH SYSTEM - USAGE EXAMPLES');
  console.log('='.repeat(70));

  try {
    await example1_GenerateEmbedding();
    await example2_BatchGeneration();
    await example3_SemanticSearch();
    await example4_HybridSearch();
    await example5_AutoComplete();
    await example6_DuplicateDetection();
    await example7_RelatedArticles();
    await example8_Statistics();
    await example9_UpdateOnChange();
    await example10_WeightComparison();

    console.log('\n' + '='.repeat(70));
    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export examples for selective execution
export {
  example1_GenerateEmbedding,
  example2_BatchGeneration,
  example3_SemanticSearch,
  example4_HybridSearch,
  example5_AutoComplete,
  example6_DuplicateDetection,
  example7_RelatedArticles,
  example8_Statistics,
  example9_UpdateOnChange,
  example10_WeightComparison,
  runAllExamples
};

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
