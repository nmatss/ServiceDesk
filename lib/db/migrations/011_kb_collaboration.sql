-- Knowledge Base Collaboration Features Migration
-- Adds tables for reviews, versions, analytics, and search tracking

-- Article Reviews
CREATE TABLE IF NOT EXISTS kb_article_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'changes_requested')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comments TEXT,
    suggested_changes TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Article Versions
CREATE TABLE IF NOT EXISTS kb_article_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    change_summary TEXT,
    author_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(article_id, version_number)
);

-- Article Comments
CREATE TABLE IF NOT EXISTS kb_article_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    parent_comment_id INTEGER,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES kb_article_comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Article Feedback (helpful/not helpful)
CREATE TABLE IF NOT EXISTS kb_article_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    user_id INTEGER,
    session_id TEXT,
    is_helpful BOOLEAN NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Search History
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    results_count INTEGER NOT NULL DEFAULT 0,
    search_mode TEXT DEFAULT 'hybrid', -- semantic, keyword, hybrid
    user_id INTEGER,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Search Analytics (click tracking)
CREATE TABLE IF NOT EXISTS search_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    article_id INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    user_id INTEGER,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Article View Tracking
CREATE TABLE IF NOT EXISTS kb_article_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    user_id INTEGER,
    session_id TEXT,
    time_on_page INTEGER, -- seconds
    referrer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Knowledge Base Tags
CREATE TABLE IF NOT EXISTS kb_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Article Tags Relationship
CREATE TABLE IF NOT EXISTS kb_article_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES kb_tags(id) ON DELETE CASCADE,
    UNIQUE(article_id, tag_id)
);

-- Contribution Requests
CREATE TABLE IF NOT EXISTS kb_contribution_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contributor_id INTEGER NOT NULL,
    article_id INTEGER, -- NULL for new articles
    type TEXT NOT NULL CHECK (type IN ('new_article', 'edit', 'translation', 'improvement')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category_id INTEGER,
    tags TEXT, -- JSON
    reasoning TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    assigned_reviewer_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contributor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES kb_articles(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_reviewer_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kb_reviews_article ON kb_article_reviews(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_reviews_reviewer ON kb_article_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_kb_reviews_status ON kb_article_reviews(status);

CREATE INDEX IF NOT EXISTS idx_kb_versions_article ON kb_article_versions(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_versions_author ON kb_article_versions(author_id);
CREATE INDEX IF NOT EXISTS idx_kb_versions_status ON kb_article_versions(status);

CREATE INDEX IF NOT EXISTS idx_kb_comments_article ON kb_article_comments(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_comments_user ON kb_article_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_kb_comments_parent ON kb_article_comments(parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_kb_feedback_article ON kb_article_feedback(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_feedback_helpful ON kb_article_feedback(is_helpful);

CREATE INDEX IF NOT EXISTS idx_search_history_query ON search_history(query);
CREATE INDEX IF NOT EXISTS idx_search_history_created ON search_history(created_at);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);
CREATE INDEX IF NOT EXISTS idx_search_analytics_article ON search_analytics(article_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_kb_views_article ON kb_article_views(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_views_created ON kb_article_views(created_at);

CREATE INDEX IF NOT EXISTS idx_kb_tags_name ON kb_tags(name);
CREATE INDEX IF NOT EXISTS idx_kb_tags_slug ON kb_tags(slug);

CREATE INDEX IF NOT EXISTS idx_kb_article_tags_article ON kb_article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_kb_article_tags_tag ON kb_article_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_kb_contributions_contributor ON kb_contribution_requests(contributor_id);
CREATE INDEX IF NOT EXISTS idx_kb_contributions_status ON kb_contribution_requests(status);
CREATE INDEX IF NOT EXISTS idx_kb_contributions_reviewer ON kb_contribution_requests(assigned_reviewer_id);

-- Triggers for updating timestamps
CREATE TRIGGER IF NOT EXISTS update_kb_comments_timestamp
AFTER UPDATE ON kb_article_comments
FOR EACH ROW
BEGIN
    UPDATE kb_article_comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_kb_contributions_timestamp
AFTER UPDATE ON kb_contribution_requests
FOR EACH ROW
BEGIN
    UPDATE kb_contribution_requests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update tag usage count
CREATE TRIGGER IF NOT EXISTS update_tag_usage_count_insert
AFTER INSERT ON kb_article_tags
FOR EACH ROW
BEGIN
    UPDATE kb_tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
END;

CREATE TRIGGER IF NOT EXISTS update_tag_usage_count_delete
AFTER DELETE ON kb_article_tags
FOR EACH ROW
BEGIN
    UPDATE kb_tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
END;
