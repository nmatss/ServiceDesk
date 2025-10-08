-- Migration: Add organization_id to KB tables
-- Version: 004

ALTER TABLE kb_articles ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_kb_articles_organization ON kb_articles(organization_id);
CREATE INDEX idx_kb_articles_org_published ON kb_articles(organization_id, status);

ALTER TABLE kb_categories ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_kb_categories_organization ON kb_categories(organization_id);

ALTER TABLE kb_tags ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_kb_tags_organization ON kb_tags(organization_id);

ALTER TABLE kb_article_feedback ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;

-- Legacy table
ALTER TABLE knowledge_articles ADD COLUMN organization_id INTEGER DEFAULT 1 REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_knowledge_articles_organization ON knowledge_articles(organization_id);
