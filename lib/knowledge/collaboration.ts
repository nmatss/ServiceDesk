/**
 * Knowledge Base Collaboration System
 * Manages community contributions, peer review workflow,
 * version control, comments, ratings, and usage analytics
 */

import type { KBArticle, User } from '../types/database';

// Types
export interface ArticleVersion {
  id: string;
  article_id: string;
  version_number: number;
  title: string;
  content: string;
  change_summary: string;
  author_id: string;
  created_at: Date;
  status: 'draft' | 'review' | 'approved' | 'published' | 'rejected';
}

export interface ArticleReview {
  id: string;
  article_id: string;
  version_id: string;
  reviewer_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  rating: number; // 1-5
  comments: string;
  reviewed_at: Date;
}

export interface ArticleComment {
  id: string;
  article_id: string;
  parent_comment_id?: string;
  user_id: string;
  content: string;
  is_resolved: boolean;
  created_at: Date;
  updated_at: Date;
  replies?: ArticleComment[];
}

export interface ArticleFeedback {
  id: string;
  article_id: string;
  user_id?: string;
  is_helpful: boolean;
  rating?: number; // 1-5
  comment?: string;
  created_at: Date;
}

export interface ArticleAnalytics {
  article_id: string;
  views: number;
  unique_views: number;
  helpful_votes: number;
  not_helpful_votes: number;
  avg_rating: number;
  shares: number;
  time_on_page: number;
  bounce_rate: number;
  search_appearances: number;
  click_through_rate: number;
}

export interface ContributionRequest {
  id: string;
  contributor_id: string;
  article_id?: string; // null for new articles
  type: 'new_article' | 'edit' | 'translation' | 'improvement';
  title: string;
  content: string;
  category_id: string;
  tags: string[];
  reasoning: string;
  status: 'pending' | 'approved' | 'rejected';
  assigned_reviewer_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface DiffChange {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

/**
 * Knowledge Base Collaboration Manager
 */
export class KBCollaborationManager {
  private versions: Map<string, ArticleVersion[]> = new Map();
  private reviews: Map<string, ArticleReview[]> = new Map();
  private comments: Map<string, ArticleComment[]> = new Map();
  private feedback: Map<string, ArticleFeedback[]> = new Map();
  private analytics: Map<string, ArticleAnalytics> = new Map();

  /**
   * Submit a community contribution
   */
  async submitContribution(
    contributorId: string,
    contribution: Partial<ContributionRequest>
  ): Promise<ContributionRequest> {
    const request: ContributionRequest = {
      id: this.generateId(),
      contributor_id: contributorId,
      article_id: contribution.article_id,
      type: contribution.type || 'new_article',
      title: contribution.title || '',
      content: contribution.content || '',
      category_id: contribution.category_id || '',
      tags: contribution.tags || [],
      reasoning: contribution.reasoning || '',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    };

    // In production, save to database
    // await db.query('INSERT INTO contribution_requests ...', request);

    // Auto-assign to reviewer based on category expertise
    request.assigned_reviewer_id = await this.assignReviewer(
      request.category_id,
      request.type
    );

    return request;
  }

  /**
   * Auto-assign reviewer based on expertise
   */
  private async assignReviewer(
    categoryId: string,
    contributionType: string
  ): Promise<string | undefined> {
    // In production, query database for best reviewer
    // SELECT user_id FROM category_experts
    // WHERE category_id = ? AND review_count < 10
    // ORDER BY avg_review_quality DESC, review_count ASC
    // LIMIT 1

    return undefined; // Placeholder
  }

  /**
   * Create new article version
   */
  async createVersion(
    articleId: string,
    authorId: string,
    changes: {
      title?: string;
      content?: string;
      changeSummary: string;
    }
  ): Promise<ArticleVersion> {
    const existingVersions = this.versions.get(articleId) || [];
    const nextVersionNumber = existingVersions.length + 1;

    const version: ArticleVersion = {
      id: this.generateId(),
      article_id: articleId,
      version_number: nextVersionNumber,
      title: changes.title || '',
      content: changes.content || '',
      change_summary: changes.changeSummary,
      author_id: authorId,
      created_at: new Date(),
      status: 'draft',
    };

    existingVersions.push(version);
    this.versions.set(articleId, existingVersions);

    return version;
  }

  /**
   * Submit version for review
   */
  async submitForReview(versionId: string): Promise<void> {
    // Find version and update status
    for (const [articleId, versions] of this.versions.entries()) {
      const version = versions.find(v => v.id === versionId);
      if (version) {
        version.status = 'review';

        // Notify reviewers
        await this.notifyReviewers(articleId, versionId);
        break;
      }
    }
  }

  /**
   * Notify assigned reviewers
   */
  private async notifyReviewers(articleId: string, versionId: string): Promise<void> {
    // In production, send notifications
    // const reviewers = await db.query('SELECT reviewer_id FROM article_reviewers WHERE article_id = ?', articleId);
    // for (const reviewer of reviewers) {
    //   await notificationEngine.send(reviewer.id, {
    //     type: 'review_requested',
    //     article_id: articleId,
    //     version_id: versionId
    //   });
    // }
  }

  /**
   * Submit review for article version
   */
  async submitReview(
    versionId: string,
    reviewerId: string,
    review: {
      status: 'approved' | 'rejected' | 'changes_requested';
      rating: number;
      comments: string;
    }
  ): Promise<ArticleReview> {
    const articleReview: ArticleReview = {
      id: this.generateId(),
      article_id: '', // Will be filled from version
      version_id: versionId,
      reviewer_id: reviewerId,
      status: review.status,
      rating: review.rating,
      comments: review.comments,
      reviewed_at: new Date(),
    };

    // Find the version and update its status
    for (const [articleId, versions] of this.versions.entries()) {
      const version = versions.find(v => v.id === versionId);
      if (version) {
        articleReview.article_id = articleId;

        // Update version status based on review
        if (review.status === 'approved') {
          version.status = 'approved';
        } else if (review.status === 'rejected') {
          version.status = 'rejected';
        }

        // Store review
        const articleReviews = this.reviews.get(articleId) || [];
        articleReviews.push(articleReview);
        this.reviews.set(articleId, articleReviews);

        break;
      }
    }

    return articleReview;
  }

  /**
   * Publish approved version
   */
  async publishVersion(versionId: string): Promise<void> {
    for (const [articleId, versions] of this.versions.entries()) {
      const version = versions.find(v => v.id === versionId);
      if (version && version.status === 'approved') {
        version.status = 'published';

        // In production, update main article with this version's content
        // await db.query('UPDATE kb_articles SET title = ?, content = ?, version = ? WHERE id = ?',
        //   [version.title, version.content, version.version_number, articleId]);

        break;
      }
    }
  }

  /**
   * Get version history for article
   */
  getVersionHistory(articleId: string): ArticleVersion[] {
    return this.versions.get(articleId) || [];
  }

  /**
   * Get diff between two versions
   */
  getDiff(versionId1: string, versionId2: string): DiffChange[] {
    let version1: ArticleVersion | undefined;
    let version2: ArticleVersion | undefined;

    // Find both versions
    for (const versions of this.versions.values()) {
      if (!version1) version1 = versions.find(v => v.id === versionId1);
      if (!version2) version2 = versions.find(v => v.id === versionId2);
      if (version1 && version2) break;
    }

    if (!version1 || !version2) {
      return [];
    }

    return this.computeDiff(version1.content, version2.content);
  }

  /**
   * Compute diff between two text contents
   */
  private computeDiff(text1: string, text2: string): DiffChange[] {
    const lines1 = text1.split('\n');
    const lines2 = text2.split('\n');
    const changes: DiffChange[] = [];

    // Simple line-by-line diff (in production, use a proper diff library)
    const maxLines = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 === line2) {
        changes.push({
          type: 'unchanged',
          content: line1 || '',
          lineNumber: i + 1,
        });
      } else if (line1 && !line2) {
        changes.push({
          type: 'removed',
          content: line1,
          lineNumber: i + 1,
        });
      } else if (!line1 && line2) {
        changes.push({
          type: 'added',
          content: line2,
          lineNumber: i + 1,
        });
      } else {
        // Both exist but different - mark as removed then added
        changes.push({
          type: 'removed',
          content: line1,
          lineNumber: i + 1,
        });
        changes.push({
          type: 'added',
          content: line2,
          lineNumber: i + 1,
        });
      }
    }

    return changes;
  }

  /**
   * Add comment to article
   */
  async addComment(
    articleId: string,
    userId: string,
    content: string,
    parentCommentId?: string
  ): Promise<ArticleComment> {
    const comment: ArticleComment = {
      id: this.generateId(),
      article_id: articleId,
      parent_comment_id: parentCommentId,
      user_id: userId,
      content,
      is_resolved: false,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const articleComments = this.comments.get(articleId) || [];
    articleComments.push(comment);
    this.comments.set(articleId, articleComments);

    return comment;
  }

  /**
   * Get comment threads for article
   */
  getCommentThreads(articleId: string): ArticleComment[] {
    const allComments = this.comments.get(articleId) || [];

    // Build tree structure
    const topLevelComments = allComments.filter(c => !c.parent_comment_id);

    for (const comment of topLevelComments) {
      comment.replies = this.getReplies(comment.id, allComments);
    }

    return topLevelComments;
  }

  /**
   * Get replies to a comment
   */
  private getReplies(commentId: string, allComments: ArticleComment[]): ArticleComment[] {
    const replies = allComments.filter(c => c.parent_comment_id === commentId);

    for (const reply of replies) {
      reply.replies = this.getReplies(reply.id, allComments);
    }

    return replies;
  }

  /**
   * Resolve comment thread
   */
  async resolveComment(commentId: string): Promise<void> {
    for (const comments of this.comments.values()) {
      const comment = comments.find(c => c.id === commentId);
      if (comment) {
        comment.is_resolved = true;
        break;
      }
    }
  }

  /**
   * Submit feedback for article
   */
  async submitFeedback(
    articleId: string,
    feedback: {
      userId?: string;
      isHelpful: boolean;
      rating?: number;
      comment?: string;
    }
  ): Promise<ArticleFeedback> {
    const articleFeedback: ArticleFeedback = {
      id: this.generateId(),
      article_id: articleId,
      user_id: feedback.userId,
      is_helpful: feedback.isHelpful,
      rating: feedback.rating,
      comment: feedback.comment,
      created_at: new Date(),
    };

    const existingFeedback = this.feedback.get(articleId) || [];
    existingFeedback.push(articleFeedback);
    this.feedback.set(articleId, existingFeedback);

    // Update analytics
    this.updateAnalytics(articleId);

    return articleFeedback;
  }

  /**
   * Track article view
   */
  async trackView(
    articleId: string,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    let analytics = this.analytics.get(articleId);

    if (!analytics) {
      analytics = {
        article_id: articleId,
        views: 0,
        unique_views: 0,
        helpful_votes: 0,
        not_helpful_votes: 0,
        avg_rating: 0,
        shares: 0,
        time_on_page: 0,
        bounce_rate: 0,
        search_appearances: 0,
        click_through_rate: 0,
      };
    }

    analytics.views++;

    // Track unique views (simplified - in production use session tracking)
    if (userId) {
      analytics.unique_views++;
    }

    this.analytics.set(articleId, analytics);
  }

  /**
   * Track time spent on article
   */
  async trackTimeOnPage(articleId: string, seconds: number): Promise<void> {
    const analytics = this.analytics.get(articleId);
    if (analytics) {
      // Update average time on page
      const totalTime = analytics.time_on_page * analytics.views;
      analytics.time_on_page = (totalTime + seconds) / (analytics.views + 1);

      this.analytics.set(articleId, analytics);
    }
  }

  /**
   * Track article share
   */
  async trackShare(articleId: string): Promise<void> {
    const analytics = this.analytics.get(articleId);
    if (analytics) {
      analytics.shares++;
      this.analytics.set(articleId, analytics);
    }
  }

  /**
   * Update analytics based on feedback
   */
  private updateAnalytics(articleId: string): void {
    const feedbackList = this.feedback.get(articleId) || [];
    let analytics = this.analytics.get(articleId);

    if (!analytics) {
      analytics = {
        article_id: articleId,
        views: 0,
        unique_views: 0,
        helpful_votes: 0,
        not_helpful_votes: 0,
        avg_rating: 0,
        shares: 0,
        time_on_page: 0,
        bounce_rate: 0,
        search_appearances: 0,
        click_through_rate: 0,
      };
    }

    // Count helpful/not helpful votes
    analytics.helpful_votes = feedbackList.filter(f => f.is_helpful).length;
    analytics.not_helpful_votes = feedbackList.filter(f => !f.is_helpful).length;

    // Calculate average rating
    const ratings = feedbackList.filter(f => f.rating).map(f => f.rating!);
    if (ratings.length > 0) {
      analytics.avg_rating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    }

    this.analytics.set(articleId, analytics);
  }

  /**
   * Get analytics for article
   */
  getAnalytics(articleId: string): ArticleAnalytics | undefined {
    return this.analytics.get(articleId);
  }

  /**
   * Get analytics for multiple articles
   */
  getBatchAnalytics(articleIds: string[]): Map<string, ArticleAnalytics> {
    const results = new Map<string, ArticleAnalytics>();

    for (const articleId of articleIds) {
      const analytics = this.analytics.get(articleId);
      if (analytics) {
        results.set(articleId, analytics);
      }
    }

    return results;
  }

  /**
   * Get top contributors
   */
  async getTopContributors(limit: number = 10): Promise<Array<{
    userId: string;
    contributionCount: number;
    approvedCount: number;
    avgRating: number;
  }>> {
    const contributors = new Map<string, {
      count: number;
      approved: number;
      ratings: number[];
    }>();

    // Aggregate from versions
    for (const versions of this.versions.values()) {
      for (const version of versions) {
        const existing = contributors.get(version.author_id) || {
          count: 0,
          approved: 0,
          ratings: [],
        };

        existing.count++;
        if (version.status === 'approved' || version.status === 'published') {
          existing.approved++;
        }

        contributors.set(version.author_id, existing);
      }
    }

    // Add ratings from reviews
    for (const reviews of this.reviews.values()) {
      for (const review of reviews) {
        // Find version author
        for (const versions of this.versions.values()) {
          const version = versions.find(v => v.id === review.version_id);
          if (version) {
            const existing = contributors.get(version.author_id);
            if (existing) {
              existing.ratings.push(review.rating);
            }
            break;
          }
        }
      }
    }

    // Convert to result format
    return Array.from(contributors.entries())
      .map(([userId, data]) => ({
        userId,
        contributionCount: data.count,
        approvedCount: data.approved,
        avgRating: data.ratings.length > 0
          ? data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length
          : 0,
      }))
      .sort((a, b) => b.approvedCount - a.approvedCount)
      .slice(0, limit);
  }

  /**
   * Get articles needing review
   */
  getArticlesNeedingReview(): Array<{
    articleId: string;
    versionId: string;
    authorId: string;
    createdAt: Date;
  }> {
    const needingReview: Array<any> = [];

    for (const [articleId, versions] of this.versions.entries()) {
      for (const version of versions) {
        if (version.status === 'review') {
          needingReview.push({
            articleId,
            versionId: version.id,
            authorId: version.author_id,
            createdAt: version.created_at,
          });
        }
      }
    }

    return needingReview.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Generate contribution report
   */
  generateContributionReport(userId: string): {
    totalContributions: number;
    approvedContributions: number;
    rejectedContributions: number;
    pendingReview: number;
    avgReviewRating: number;
    topArticles: string[];
  } {
    let total = 0;
    let approved = 0;
    let rejected = 0;
    let pending = 0;
    const ratings: number[] = [];
    const articleEngagement = new Map<string, number>();

    // Count versions by user
    for (const [articleId, versions] of this.versions.entries()) {
      for (const version of versions) {
        if (version.author_id === userId) {
          total++;

          if (version.status === 'approved' || version.status === 'published') {
            approved++;

            // Track article engagement
            const analytics = this.analytics.get(articleId);
            if (analytics) {
              articleEngagement.set(articleId, analytics.views + analytics.helpful_votes * 10);
            }
          } else if (version.status === 'rejected') {
            rejected++;
          } else if (version.status === 'review') {
            pending++;
          }

          // Find reviews for this version
          const reviews = this.reviews.get(articleId) || [];
          const versionReviews = reviews.filter(r => r.version_id === version.id);
          ratings.push(...versionReviews.map(r => r.rating));
        }
      }
    }

    // Get top articles by engagement
    const topArticles = Array.from(articleEngagement.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([articleId]) => articleId);

    return {
      totalContributions: total,
      approvedContributions: approved,
      rejectedContributions: rejected,
      pendingReview: pending,
      avgReviewRating: ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
        : 0,
      topArticles,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const kbCollaborationManager = new KBCollaborationManager();
