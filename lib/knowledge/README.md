# Knowledge Base Semantic Search - SPRINT 4

Complete implementation of advanced knowledge base search and collaboration features.

## 📁 Files Created/Updated

### Core Libraries

#### 1. **lib/knowledge/semantic-search.ts**
Advanced semantic search engine with:
- ✅ Vector database integration (OpenAI embeddings)
- ✅ Hybrid search (keyword + semantic)
- ✅ BM25 algorithm for keyword search
- ✅ Cosine similarity for semantic matching
- ✅ Auto-complete intelligent suggestions
- ✅ Faceted search (filters by category, tags, date, votes)
- ✅ Search analytics tracking
- ✅ Result ranking algorithm with recency and quality boosts
- ✅ Cache management for performance

**Key Classes:**
```typescript
class SemanticSearchEngine {
  // Vector embeddings
  generateEmbedding(text: string): Promise<number[]>

  // Search methods
  hybridSearch(query: string, articles: KBArticle[], options?: SearchOptions)
  semanticSearch(query: string, articles: KBArticle[], limit?: number)
  keywordSearch(query: string, articles: KBArticle[], limit?: number)

  // Auto-complete
  getAutoCompleteSuggestions(partialQuery: string, articles: KBArticle[], limit?: number)

  // Facets
  getFacets(articles: KBArticle[])

  // Analytics
  trackSearch(analytics: SearchAnalytics)
  getSearchAnalytics(userId?: string, days?: number)
}
```

#### 2. **lib/knowledge/auto-generator.ts** (Updated)
AI-powered content generation:
- ✅ FAQ generation from resolved tickets
- ✅ Article suggestions based on patterns
- ✅ Content gap analysis (topics without articles)
- ✅ Auto-categorization of articles
- ✅ Quality scoring of generated content
- ✅ Template-based generation (troubleshooting, how-to, FAQ, quick-fix)
- ✅ Batch generation support

**Key Methods:**
```typescript
class AutoGenerator {
  // Generate articles from tickets
  generateArticle(request: ArticleGenerationRequest): Promise<GeneratedArticle>

  // Find content gaps
  findGenerationCandidates(): Promise<Candidate[]>

  // Auto-categorize
  autoCategorize(article: Partial<KBArticle>, categories: string[])

  // Quality scoring
  scoreArticleQuality(article: KBArticle): Promise<QualityScore>

  // Batch operations
  batchGenerate(authorId: number): Promise<BatchResult[]>
}
```

#### 3. **lib/knowledge/collaboration.ts** (New)
Community contribution and peer review system:
- ✅ Community contribution workflow
- ✅ Peer review system (draft → review → approved → published)
- ✅ Version control with visual diff
- ✅ Comment threads on articles
- ✅ Rating and feedback system
- ✅ Usage analytics (views, helpful votes, shares, time on page)
- ✅ Contribution reporting and leaderboards

**Key Classes:**
```typescript
class KBCollaborationManager {
  // Contributions
  submitContribution(contributorId: string, contribution: ContributionRequest)

  // Version control
  createVersion(articleId: string, authorId: string, changes: VersionChanges)
  getVersionHistory(articleId: string): ArticleVersion[]
  getDiff(versionId1: string, versionId2: string): DiffChange[]

  // Review workflow
  submitForReview(versionId: string)
  submitReview(versionId: string, reviewerId: string, review: Review)
  publishVersion(versionId: string)

  // Comments
  addComment(articleId: string, userId: string, content: string)
  getCommentThreads(articleId: string): ArticleComment[]

  // Analytics
  trackView(articleId: string, userId?: string)
  trackTimeOnPage(articleId: string, seconds: number)
  getAnalytics(articleId: string): ArticleAnalytics

  // Reporting
  getTopContributors(limit?: number)
  generateContributionReport(userId: string)
}
```

### Frontend Components

#### 4. **src/components/knowledge/SemanticSearchBar.tsx** (New)
Advanced search UI component:
- ✅ Real-time auto-complete suggestions
- ✅ Search filters panel
- ✅ Recent searches (localStorage)
- ✅ Popular searches display
- ✅ Keyboard navigation (arrows, enter, escape)
- ✅ Faceted filtering UI
- ✅ Search highlights

**Props:**
```typescript
interface SemanticSearchBarProps {
  onSearch: (query: string, filters?: SearchFilter) => void
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void
  placeholder?: string
  showFilters?: boolean
  showSuggestions?: boolean
  className?: string
}
```

### API Endpoints

#### 5. **app/api/knowledge/search/route.ts** (Updated)
Main search API:
- ✅ GET: Semantic/hybrid search endpoint
- ✅ POST: Click tracking for analytics
- ✅ Support for multiple search modes (semantic, keyword, hybrid)
- ✅ Faceted filtering
- ✅ Pagination support
- ✅ Analytics integration

**Endpoints:**
```
GET  /api/knowledge/search?q=query&mode=hybrid&category=tech&tags=sql,database&limit=10&offset=0
POST /api/knowledge/search (body: { query, articleId, position, userId })
```

#### 6. **app/api/knowledge/search/autocomplete/route.ts** (New)
Auto-complete suggestions:
- ✅ Intelligent suggestion generation
- ✅ Type detection (article, tag, category, query)
- ✅ Configurable limit

**Endpoint:**
```
GET /api/knowledge/search/autocomplete?q=partial&limit=5
```

#### 7. **app/api/knowledge/search/popular/route.ts** (New)
Popular/trending searches:
- ✅ Top queries analytics
- ✅ Configurable time range
- ✅ Search volume statistics

**Endpoint:**
```
GET /api/knowledge/search/popular?limit=10&days=30
```

### Utilities

#### 8. **src/hooks/useDebounce.tsx** (New)
Debounce hook for search input:
- ✅ Configurable delay
- ✅ TypeScript generic support
- ✅ Cleanup on unmount

## 🚀 Usage Examples

### Basic Search
```typescript
import { semanticSearchEngine } from '@/lib/knowledge/semantic-search';

// Perform hybrid search
const results = await semanticSearchEngine.hybridSearch(
  'how to reset password',
  articles,
  {
    limit: 10,
    hybridMode: 'hybrid',
    filters: {
      categories: ['account'],
      minHelpfulVotes: 5,
    },
    boostRecent: true,
  }
);
```

### Auto-complete
```typescript
const suggestions = await semanticSearchEngine.getAutoCompleteSuggestions(
  'how to',
  articles,
  5
);
// Returns: ['how to reset password', 'how to login', ...]
```

### Track Search
```typescript
semanticSearchEngine.trackSearch({
  query: 'password reset',
  resultsCount: 10,
  clickedArticleId: 'article-123',
  clickPosition: 2,
  userId: 'user-456',
  timestamp: new Date(),
});
```

### Generate FAQ from Tickets
```typescript
import { kbAutoGenerator } from '@/lib/knowledge/auto-generator';

const faqCandidates = await kbAutoGenerator.generateFAQFromTickets(
  resolvedTickets,
  3 // minimum occurrences
);

// Returns: [{ question, answer, confidence, sourceTickets, ... }]
```

### Content Gap Analysis
```typescript
const gaps = kbAutoGenerator.identifyContentGaps(existingArticles);

// Returns: [{ topic, ticketCount, impact, suggestedTitle, ... }]
```

### Submit Community Contribution
```typescript
import { kbCollaborationManager } from '@/lib/knowledge/collaboration';

const contribution = await kbCollaborationManager.submitContribution(
  userId,
  {
    type: 'new_article',
    title: 'How to Configure SSL',
    content: '...',
    category_id: 'tech',
    tags: ['ssl', 'security'],
    reasoning: 'Missing documentation for SSL setup',
  }
);
```

### Version Control
```typescript
// Create new version
const version = await kbCollaborationManager.createVersion(
  articleId,
  authorId,
  {
    title: 'Updated: How to Configure SSL',
    content: '... updated content ...',
    changeSummary: 'Added TLS 1.3 configuration steps',
  }
);

// Submit for review
await kbCollaborationManager.submitForReview(version.id);

// Get diff between versions
const diff = kbCollaborationManager.getDiff(version1.id, version2.id);
```

### Using SemanticSearchBar Component
```tsx
import { SemanticSearchBar } from '@/src/components/knowledge/SemanticSearchBar';

function KnowledgeBasePage() {
  const handleSearch = (query: string, filters?: SearchFilter) => {
    // Perform search
    console.log('Searching for:', query, 'with filters:', filters);
  };

  return (
    <SemanticSearchBar
      onSearch={handleSearch}
      showFilters={true}
      showSuggestions={true}
      placeholder="Search knowledge base..."
    />
  );
}
```

## 📊 Analytics Features

### Search Analytics
- Query tracking
- Click-through rate (CTR)
- Search result effectiveness
- Popular queries identification
- User search patterns

### Article Analytics
- View counts
- Unique views tracking
- Time on page
- Helpful/not helpful votes
- Share counts
- Search appearances

### Contribution Analytics
- Top contributors leaderboard
- Contribution acceptance rate
- Average review ratings
- Article engagement metrics

## 🎯 Search Modes

### 1. **Semantic Search**
Uses vector embeddings to find conceptually similar articles:
```typescript
mode: 'semantic'
```

### 2. **Keyword Search**
Uses BM25 algorithm for exact keyword matching:
```typescript
mode: 'keyword'
```

### 3. **Hybrid Search** (Recommended)
Combines both approaches with weighted scoring:
```typescript
mode: 'hybrid' // 40% keyword + 60% semantic
```

## 🔍 Faceted Search

Supported facets:
- **Categories**: Filter by article category
- **Tags**: Filter by article tags
- **Date Range**: Filter by creation/update date
- **Helpful Votes**: Filter by minimum helpful votes
- **Status**: Filter by article status (published, draft, archived)

## 🎨 UI Features

### Search Bar
- Instant auto-complete
- Recent searches history
- Popular searches display
- Keyboard navigation
- Clear button
- Filter panel toggle

### Filter Panel
- Date range picker
- Minimum votes input
- Status dropdown
- Clear all filters button
- Active filter count badge

## 📈 Performance Optimizations

- **Vector Caching**: Embedding vectors cached in memory
- **Debounced Input**: 300ms delay for auto-complete
- **Pagination**: Offset-based pagination for large result sets
- **Lazy Loading**: Results loaded on-demand
- **Search History**: Limited to 10 recent searches in localStorage

## 🔐 Security Considerations

- Input sanitization for all search queries
- Rate limiting recommended for API endpoints
- User authentication for contribution submissions
- Review workflow for community content
- XSS protection in search highlights

## 🚧 Future Enhancements

- [ ] Pinecone/Weaviate integration for production vector DB
- [ ] Elasticsearch integration for enterprise scale
- [ ] Multi-language support
- [ ] Image search within articles
- [ ] PDF/document indexing
- [ ] Advanced NLP for query understanding
- [ ] A/B testing for ranking algorithms
- [ ] Machine learning for personalized results

## 📝 Configuration

### Environment Variables
```env
OPENAI_API_KEY=your_openai_api_key
```

### Search Configuration
```typescript
// In semantic-search.ts
const SIMILARITY_THRESHOLD = 0.5;  // Minimum similarity score
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CACHE_SIZE = 1000;  // Vector cache size
```

## 🧪 Testing

### Manual Testing
```bash
# Test search endpoint
curl "http://localhost:3000/api/knowledge/search?q=password&mode=hybrid"

# Test auto-complete
curl "http://localhost:3000/api/knowledge/search/autocomplete?q=pass"

# Test popular searches
curl "http://localhost:3000/api/knowledge/search/popular?limit=5"
```

### Integration Testing
```typescript
// Example test
describe('Semantic Search', () => {
  it('should return relevant results', async () => {
    const results = await semanticSearchEngine.hybridSearch(
      'password reset',
      testArticles
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchType).toBe('hybrid');
  });
});
```

## 📚 Dependencies

- `openai`: For embeddings generation
- `fuse.js`: For fuzzy keyword search
- `@heroicons/react`: For UI icons
- React hooks: useState, useEffect, useRef, useCallback

## 🎓 Learning Resources

- [Vector Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [BM25 Algorithm](https://en.wikipedia.org/wiki/Okapi_BM25)
- [Cosine Similarity](https://en.wikipedia.org/wiki/Cosine_similarity)
- [Hybrid Search Best Practices](https://www.pinecone.io/learn/hybrid-search/)

---

**Status**: ✅ SPRINT 4 Complete

**Author**: Claude Code Assistant
**Date**: 2025-10-05
**Version**: 1.0.0
