-- ============================================================================
-- Dashboard System Schema
-- ============================================================================

-- Dashboards table for storing custom dashboard configurations
CREATE TABLE IF NOT EXISTS dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    config TEXT NOT NULL, -- JSON configuration
    user_id INTEGER NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Dashboard templates for predefined layouts
CREATE TABLE IF NOT EXISTS dashboard_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    config TEXT NOT NULL, -- JSON configuration
    category TEXT NOT NULL CHECK (category IN ('executive', 'agent', 'sla', 'customer', 'technical', 'custom')),
    preview_image TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard widgets registry
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    widget_type TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('kpi', 'charts', 'tables', 'alerts', 'custom')),
    data_source TEXT, -- References data source ID
    default_config TEXT, -- JSON default configuration
    required_permissions TEXT, -- JSON array of required permissions
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard scheduled exports
CREATE TABLE IF NOT EXISTS dashboard_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    schedule TEXT NOT NULL CHECK (schedule IN ('daily', 'weekly', 'monthly', 'quarterly')),
    format TEXT NOT NULL CHECK (format IN ('pdf', 'excel', 'csv')),
    recipients TEXT NOT NULL, -- JSON array of email addresses
    last_run_at DATETIME,
    next_run_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Dashboard access log for analytics
CREATE TABLE IF NOT EXISTS dashboard_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    access_type TEXT NOT NULL CHECK (access_type IN ('view', 'edit', 'export', 'share')),
    ip_address TEXT,
    user_agent TEXT,
    session_duration INTEGER, -- in seconds
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboards_user_id ON dashboards(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_is_default ON dashboards(is_default);
CREATE INDEX IF NOT EXISTS idx_dashboards_is_shared ON dashboards(is_shared);
CREATE INDEX IF NOT EXISTS idx_dashboard_templates_category ON dashboard_templates(category);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_category ON dashboard_widgets(category);
CREATE INDEX IF NOT EXISTS idx_dashboard_exports_dashboard_id ON dashboard_exports(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_exports_next_run ON dashboard_exports(next_run_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_dashboard ON dashboard_access_log(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_user ON dashboard_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_access_log_accessed_at ON dashboard_access_log(accessed_at);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_dashboards_timestamp
AFTER UPDATE ON dashboards
FOR EACH ROW
BEGIN
    UPDATE dashboards SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_dashboard_templates_timestamp
AFTER UPDATE ON dashboard_templates
FOR EACH ROW
BEGIN
    UPDATE dashboard_templates SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_dashboard_exports_timestamp
AFTER UPDATE ON dashboard_exports
FOR EACH ROW
BEGIN
    UPDATE dashboard_exports SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- Seed Data: Dashboard Templates
-- ============================================================================

INSERT OR IGNORE INTO dashboard_templates (name, display_name, description, config, category, is_system, is_active)
VALUES
(
    'executive_overview',
    'Executive Overview',
    'High-level KPIs and trends for executive decision-making',
    '{"layouts":{"lg":[{"i":"kpi-summary","x":0,"y":0,"w":12,"h":3},{"i":"sla-performance","x":0,"y":3,"w":6,"h":4},{"i":"ticket-volume","x":6,"y":3,"w":6,"h":4},{"i":"agent-performance","x":0,"y":7,"w":8,"h":4},{"i":"category-distribution","x":8,"y":7,"w":4,"h":4}]},"widgets":[{"id":"kpi-summary","type":"kpi_summary","title":"Key Performance Indicators","config":{"showTrends":true,"compactMode":false}},{"id":"sla-performance","type":"sla_performance","title":"SLA Performance","config":{"period":"month","showTargets":true}},{"id":"ticket-volume","type":"volume_trends","title":"Ticket Volume Trends","config":{"period":"month","showForecasting":true}},{"id":"agent-performance","type":"agent_performance","title":"Agent Performance","config":{"period":"month","showTop":10}},{"id":"category-distribution","type":"category_distribution","title":"Category Distribution","config":{"period":"month","chartType":"pie"}}],"theme":"auto","refreshInterval":30000}',
    'executive',
    TRUE,
    TRUE
),
(
    'agent_performance',
    'Agent Performance Dashboard',
    'Detailed agent metrics and workload distribution',
    '{"layouts":{"lg":[{"i":"agent-metrics","x":0,"y":0,"w":12,"h":3},{"i":"agent-performance","x":0,"y":3,"w":8,"h":5},{"i":"agent-workload","x":8,"y":3,"w":4,"h":5},{"i":"response-time","x":0,"y":8,"w":6,"h":4},{"i":"resolution-time","x":6,"y":8,"w":6,"h":4}]},"widgets":[{"id":"agent-metrics","type":"kpi_summary","title":"Agent Metrics Summary","config":{"showTrends":true}},{"id":"agent-performance","type":"agent_performance","title":"Agent Performance","config":{"period":"month","showTop":20}},{"id":"agent-workload","type":"agent_workload","title":"Current Workload","config":{"showDistribution":true}},{"id":"response-time","type":"response_time_chart","title":"Response Times","config":{"period":"month"}},{"id":"resolution-time","type":"resolution_time_chart","title":"Resolution Times","config":{"period":"month"}}],"theme":"auto","refreshInterval":30000}',
    'agent',
    TRUE,
    TRUE
),
(
    'sla_compliance',
    'SLA Compliance Dashboard',
    'Track and monitor SLA performance and violations',
    '{"layouts":{"lg":[{"i":"sla-gauge","x":0,"y":0,"w":4,"h":4},{"i":"sla-trends","x":4,"y":0,"w":8,"h":4},{"i":"sla-by-priority","x":0,"y":4,"w":6,"h":4},{"i":"sla-violations","x":6,"y":4,"w":6,"h":4},{"i":"sla-alerts","x":0,"y":8,"w":12,"h":3}]},"widgets":[{"id":"sla-gauge","type":"gauge","title":"Overall SLA Compliance","config":{"target":95,"thresholds":[{"value":0,"color":"#EF4444"},{"value":80,"color":"#F59E0B"},{"value":95,"color":"#10B981"}]}},{"id":"sla-trends","type":"sla_performance","title":"SLA Trends","config":{"period":"month"}},{"id":"sla-by-priority","type":"sla_by_priority","title":"SLA by Priority","config":{"period":"month"}},{"id":"sla-violations","type":"table","title":"Recent Violations","config":{"dataSource":"sla.violations"}},{"id":"sla-alerts","type":"realtime_alerts","title":"SLA Alerts","config":{"filterType":"sla_breach"}}],"theme":"auto","refreshInterval":30000}',
    'sla',
    TRUE,
    TRUE
),
(
    'ticket_trends',
    'Ticket Trends Dashboard',
    'Analyze ticket patterns and forecasting',
    '{"layouts":{"lg":[{"i":"volume-chart","x":0,"y":0,"w":8,"h":4},{"i":"category-pie","x":8,"y":0,"w":4,"h":4},{"i":"priority-dist","x":0,"y":4,"w":4,"h":4},{"i":"status-dist","x":4,"y":4,"w":4,"h":4},{"i":"trend-table","x":8,"y":4,"w":4,"h":4},{"i":"forecasting","x":0,"y":8,"w":12,"h":4}]},"widgets":[{"id":"volume-chart","type":"volume_trends","title":"Ticket Volume","config":{"period":"month","showForecasting":false}},{"id":"category-pie","type":"category_distribution","title":"By Category","config":{"chartType":"pie"}},{"id":"priority-dist","type":"priority_matrix","title":"By Priority","config":{}},{"id":"status-dist","type":"status_distribution","title":"By Status","config":{}},{"id":"trend-table","type":"table","title":"Trend Summary","config":{"dataSource":"tickets.trends"}},{"id":"forecasting","type":"forecasting_chart","title":"Volume Forecast","config":{"period":"month"}}],"theme":"auto","refreshInterval":30000}',
    'technical',
    TRUE,
    TRUE
),
(
    'customer_satisfaction',
    'Customer Satisfaction Dashboard',
    'Monitor customer satisfaction and feedback',
    '{"layouts":{"lg":[{"i":"csat-score","x":0,"y":0,"w":4,"h":4},{"i":"csat-trends","x":4,"y":0,"w":8,"h":4},{"i":"feedback-table","x":0,"y":4,"w":8,"h":5},{"i":"sentiment","x":8,"y":4,"w":4,"h":5}]},"widgets":[{"id":"csat-score","type":"gauge","title":"CSAT Score","config":{"max":5,"target":4.5}},{"id":"csat-trends","type":"satisfaction_trends","title":"Satisfaction Trends","config":{"period":"month"}},{"id":"feedback-table","type":"table","title":"Recent Feedback","config":{"dataSource":"customers.feedback"}},{"id":"sentiment","type":"sentiment_analysis","title":"Sentiment Analysis","config":{"period":"month"}}],"theme":"auto","refreshInterval":30000}',
    'customer',
    TRUE,
    TRUE
);

-- ============================================================================
-- Seed Data: Widget Registry
-- ============================================================================

INSERT OR IGNORE INTO dashboard_widgets (widget_type, display_name, description, category, data_source, default_config, required_permissions, is_active)
VALUES
('kpi_summary', 'KPI Summary', 'Display key performance indicators', 'kpi', 'kpi.summary', '{"showTrends":true,"compactMode":false}', '[]', TRUE),
('sla_performance', 'SLA Performance', 'SLA compliance metrics over time', 'charts', 'sla.compliance', '{"period":"month","showTargets":true}', '[]', TRUE),
('agent_performance', 'Agent Performance', 'Agent productivity metrics', 'charts', 'agents.performance', '{"period":"month","showTop":10}', '["admin","manager"]', TRUE),
('volume_trends', 'Volume Trends', 'Ticket volume over time with forecasting', 'charts', 'tickets.volume', '{"period":"month","showForecasting":true}', '[]', TRUE),
('category_distribution', 'Category Distribution', 'Ticket distribution by category', 'charts', 'tickets.by_category', '{"chartType":"pie"}', '[]', TRUE),
('priority_matrix', 'Priority Matrix', 'Priority distribution analysis', 'charts', 'tickets.by_priority', '{}', '[]', TRUE),
('realtime_alerts', 'Real-time Alerts', 'Live system alerts and notifications', 'alerts', 'alerts.realtime', '{"maxAlerts":10,"autoRefresh":true}', '[]', TRUE),
('gauge', 'Gauge Widget', 'Circular gauge for single metrics', 'kpi', null, '{"min":0,"max":100,"target":80}', '[]', TRUE),
('table', 'Data Table', 'Configurable data table', 'tables', null, '{"searchable":true,"pageSize":10}', '[]', TRUE),
('metric_card', 'Metric Card', 'Single metric display with trend', 'kpi', null, '{"format":"number","showTrend":true}', '[]', TRUE),
('chart', 'Chart Widget', 'Generic chart component', 'charts', null, '{"chartType":"line","showLegend":true}', '[]', TRUE);
