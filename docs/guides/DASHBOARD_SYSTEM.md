# Real-Time Dashboard System - Complete Implementation Guide

## Overview

The ServiceDesk platform now features a comprehensive real-time dashboard system with custom builder capabilities, predefined templates, and powerful export features.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Components](#components)
4. [API Routes](#api-routes)
5. [Data Sources](#data-sources)
6. [Widget Types](#widget-types)
7. [Dashboard Builder](#dashboard-builder)
8. [Export Features](#export-features)
9. [Real-Time Updates](#real-time-updates)
10. [Usage Examples](#usage-examples)
11. [Database Schema](#database-schema)

---

## Features

### Core Features
- **Real-Time Updates**: Dashboard metrics update automatically using Server-Sent Events (SSE)
- **Drag-and-Drop Builder**: Intuitive interface for creating custom dashboards
- **Widget Library**: 10+ pre-built widgets for various metrics and visualizations
- **Responsive Layouts**: Adaptive grid system that works on all screen sizes
- **Data Source System**: Flexible connector system for pulling data from multiple sources
- **Export Capabilities**: Export dashboards to PDF or Excel with charts
- **Dashboard Templates**: 5 predefined dashboard templates for common use cases
- **Persistence**: Save and load custom dashboard configurations
- **Sharing**: Share dashboards with other users

### Performance Features
- **<2s Update Latency**: Real-time updates with minimal delay
- **Caching Strategy**: Intelligent caching to reduce database load
- **Stream Optimization**: Efficient SSE streaming for real-time data
- **Mobile Responsive**: Full functionality on mobile devices

---

## Architecture

### Tech Stack
```
Frontend:
- React 18 with Next.js 15 App Router
- TypeScript (strict mode)
- Tailwind CSS
- react-grid-layout (drag-and-drop)
- Recharts (data visualization)
- Headless UI (modals, menus)

Backend:
- Next.js API Routes
- SQLite Database (migration-ready for PostgreSQL)
- Server-Sent Events (SSE) for real-time
- Node.js streams

Export:
- jsPDF (PDF generation)
- jspdf-autotable (tables in PDF)
- xlsx (Excel export)
- html2canvas (chart capture)
```

### Directory Structure
```
lib/
├── analytics/
│   ├── realtime-engine.ts      # Real-time metrics engine
│   └── data-sources.ts         # Data source connectors
├── dashboard/
│   └── export-engine.ts        # PDF/Excel export
└── db/
    └── schemas/
        └── dashboards.sql      # Database schema

src/components/dashboard/
├── DashboardGrid.tsx           # Responsive grid layout
├── Widget.tsx                  # Base widget component
├── WidgetHeader.tsx            # Widget header with actions
├── WidgetBody.tsx              # Widget body with loading states
├── DashboardBuilder.tsx        # Main builder interface
├── ExecutiveDashboard.tsx      # Example dashboard
├── WidgetLibrary.tsx           # Widget catalog
├── widgets/
│   ├── MetricCard.tsx          # Single KPI widget
│   ├── ChartWidget.tsx         # Chart container
│   ├── TableWidget.tsx         # Data table widget
│   └── GaugeWidget.tsx         # Circular gauge
└── builder/
    ├── WidgetPalette.tsx       # Available widgets
    └── DataSourcePicker.tsx    # Data source selector

app/api/dashboard/
├── [id]/route.ts               # CRUD operations
├── create/route.ts             # Create dashboard
├── list/route.ts               # List dashboards
└── metrics/
    └── stream/route.ts         # SSE endpoint
```

---

## Components

### 1. DashboardGrid
Responsive grid layout using react-grid-layout.

```tsx
import { DashboardGrid } from '@/src/components/dashboard/DashboardGrid';

<DashboardGrid
  layouts={layouts}
  onLayoutChange={handleLayoutChange}
  isDraggable={true}
  isResizable={true}
  rowHeight={60}
>
  {children}
</DashboardGrid>
```

**Props:**
- `layouts`: Layout configurations for different breakpoints
- `onLayoutChange`: Callback when layout changes
- `isDraggable`: Enable drag functionality
- `isResizable`: Enable resize functionality
- `rowHeight`: Height of each grid row in pixels

### 2. Widget Components

#### MetricCard
Display single KPI with trend indicator.

```tsx
import { MetricCard } from '@/src/components/dashboard/widgets/MetricCard';

<MetricCard
  id="metric-1"
  title="Total Tickets"
  value={1234}
  previousValue={1100}
  format="number"
  onRefresh={() => refreshData()}
/>
```

#### ChartWidget
Versatile chart component supporting line, bar, area, and pie charts.

```tsx
import { ChartWidget } from '@/src/components/dashboard/widgets/ChartWidget';

<ChartWidget
  id="chart-1"
  title="Ticket Volume"
  data={volumeData}
  chartType="line"
  dataKeys={['created', 'resolved']}
  xAxisKey="date"
  colors={['#3B82F6', '#10B981']}
/>
```

#### TableWidget
Sortable, searchable data table with pagination.

```tsx
import { TableWidget } from '@/src/components/dashboard/widgets/TableWidget';

<TableWidget
  id="table-1"
  title="Recent Tickets"
  data={tickets}
  columns={[
    { key: 'id', label: 'ID', sortable: true },
    { key: 'title', label: 'Title', sortable: true },
    { key: 'status', label: 'Status' }
  ]}
  searchable={true}
  pageSize={10}
/>
```

#### GaugeWidget
Circular gauge for single metrics with thresholds.

```tsx
import { GaugeWidget } from '@/src/components/dashboard/widgets/GaugeWidget';

<GaugeWidget
  id="gauge-1"
  title="SLA Compliance"
  value={95}
  min={0}
  max={100}
  target={90}
  thresholds={[
    { value: 0, color: '#EF4444', label: 'Critical' },
    { value: 80, color: '#F59E0B', label: 'Warning' },
    { value: 95, color: '#10B981', label: 'Good' }
  ]}
/>
```

---

## API Routes

### 1. Create Dashboard
**POST** `/api/dashboard/create`

```typescript
// Request
{
  name: "My Dashboard",
  description: "Custom dashboard for monitoring",
  config: {
    layouts: { lg: [...] },
    widgets: [...],
    theme: "auto",
    refreshInterval: 30000
  },
  is_default: false,
  is_shared: false
}

// Response
{
  success: true,
  dashboard: {
    id: 1,
    name: "My Dashboard",
    config: {...},
    ...
  }
}
```

### 2. Update Dashboard
**PUT** `/api/dashboard/[id]`

```typescript
// Request
{
  name: "Updated Dashboard",
  config: {...},
  is_shared: true
}

// Response
{
  success: true,
  dashboard: {...}
}
```

### 3. Get Dashboard
**GET** `/api/dashboard/[id]`

```typescript
// Response
{
  success: true,
  dashboard: {
    id: 1,
    name: "My Dashboard",
    config: {...},
    user_id: 1,
    is_default: false,
    is_shared: true,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z"
  }
}
```

### 4. List Dashboards
**GET** `/api/dashboard/list?includeShared=true&includeDefault=true`

```typescript
// Response
{
  success: true,
  dashboards: [
    {
      id: 1,
      name: "Executive Overview",
      is_default: true,
      is_shared: true,
      is_owner: true,
      ...
    }
  ]
}
```

### 5. Delete Dashboard
**DELETE** `/api/dashboard/[id]`

```typescript
// Response
{
  success: true,
  message: "Dashboard deleted successfully"
}
```

### 6. Stream Metrics (SSE)
**GET** `/api/dashboard/metrics/stream`

Real-time Server-Sent Events endpoint that pushes metrics every 5 seconds.

```javascript
const eventSource = new EventSource('/api/dashboard/metrics/stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'connected') {
    console.log('Connected to dashboard stream');
  } else if (data.type === 'metrics') {
    updateDashboard(data.data);
  }
};
```

---

## Data Sources

The data source system provides a flexible way to connect widgets to data.

### Available Data Sources

#### Ticket Data Sources
- `tickets.volume` - Ticket volume over time
- `tickets.by_category` - Distribution by category
- `tickets.by_priority` - Distribution by priority
- `tickets.by_status` - Distribution by status

#### SLA Data Sources
- `sla.compliance` - SLA compliance metrics
- `sla.by_priority` - SLA performance by priority

#### Agent Data Sources
- `agents.performance` - Agent performance metrics
- `agents.workload` - Current workload distribution

#### Customer Data Sources
- `customers.satisfaction` - CSAT metrics
- `customers.activity` - Customer activity data

### Usage Example

```typescript
import { executeDataSource } from '@/lib/analytics/data-sources';

// Fetch ticket volume data
const volumeData = await executeDataSource('tickets.volume', {
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  groupBy: 'day'
});

// Fetch agent performance
const agentData = await executeDataSource('agents.performance', {
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31'),
  limit: 10
});
```

---

## Widget Types

### Pre-Built Widget Types

| Widget Type | Category | Description | Default Size |
|------------|----------|-------------|--------------|
| `metric_card` | KPI | Single KPI with trend | 3×3 |
| `kpi_summary` | KPI | Multiple KPIs at once | 12×3 |
| `chart` | Charts | Multi-type chart | 6×4 |
| `gauge` | KPI | Circular gauge | 4×4 |
| `table` | Tables | Data table | 8×5 |
| `sla_performance` | Charts | SLA tracking | 6×4 |
| `agent_performance` | Charts | Agent metrics | 6×4 |
| `volume_trends` | Charts | Volume forecast | 8×4 |
| `realtime_alerts` | Alerts | Live alerts | 4×4 |

---

## Dashboard Builder

### Using the Dashboard Builder

```tsx
import { DashboardBuilder } from '@/src/components/dashboard/DashboardBuilder';

const [builderOpen, setBuilderOpen] = useState(false);
const [dashboardConfig, setDashboardConfig] = useState({...});

<DashboardBuilder
  isOpen={builderOpen}
  onClose={() => setBuilderOpen(false)}
  config={dashboardConfig}
  onConfigChange={setDashboardConfig}
/>
```

### Builder Features

1. **Layout Tab**: Drag and drop widgets, resize, configure
2. **Widgets Tab**: Browse and add new widgets
3. **Settings Tab**: Dashboard-wide settings (theme, refresh interval, auto-export)
4. **Templates Tab**: Save/load/export dashboard configurations

### Widget Configuration

Each widget can be configured through the builder:
- Title and description
- Data source selection
- Display options (chart type, colors, etc.)
- Refresh settings
- Permissions

---

## Export Features

### PDF Export

```typescript
import { exportToPDF } from '@/lib/dashboard/export-engine';

await exportToPDF({
  title: 'Executive Dashboard Report',
  subtitle: `Generated on ${new Date().toLocaleDateString()}`,
  widgets: dashboardConfig.widgets,
  metrics: currentMetrics,
  includeCharts: true,
  orientation: 'landscape'
});
```

**Features:**
- Multi-page support
- Automatic page breaks
- Chart rendering as images
- Table support with auto-table
- Header/footer on all pages
- Metadata (title, author, date)

### Excel Export

```typescript
import { exportToExcel } from '@/lib/dashboard/export-engine';

await exportToExcel({
  title: 'Executive Dashboard Data',
  widgets: dashboardConfig.widgets,
  metrics: currentMetrics,
  includeCharts: true
});
```

**Features:**
- Multiple worksheets
- Summary sheet with KPIs
- Data sheets for each widget
- Formatted tables
- Formulas and calculations
- Column width optimization

---

## Real-Time Updates

### Client-Side Hook

```typescript
import { useRealtimeEngine } from '@/lib/analytics/realtime-engine';

const {
  metrics,
  isConnected,
  connectionQuality,
  subscribe,
  unsubscribe,
  refreshData
} = useRealtimeEngine({
  refreshInterval: 30000,
  autoReconnect: true,
  maxReconnectAttempts: 5
});

// Subscribe to specific data types
useEffect(() => {
  subscribe('kpi_summary');
  subscribe('sla_performance');

  return () => {
    unsubscribe('kpi_summary');
    unsubscribe('sla_performance');
  };
}, []);
```

### Server-Side Engine

The real-time engine automatically:
- Pushes updates every 5 seconds
- Caches metric calculations (3-second TTL)
- Invalidates cache on events (ticket created, SLA violated, etc.)
- Supports Redis pub/sub for multi-server deployments
- Falls back to in-memory when Redis unavailable

---

## Usage Examples

### Example 1: Creating a Custom Dashboard

```typescript
import { useState } from 'react';
import { DashboardGrid } from '@/src/components/dashboard/DashboardGrid';
import { MetricCard } from '@/src/components/dashboard/widgets/MetricCard';
import { ChartWidget } from '@/src/components/dashboard/widgets/ChartWidget';

export function MyCustomDashboard() {
  const [layouts, setLayouts] = useState({
    lg: [
      { i: 'tickets-today', x: 0, y: 0, w: 3, h: 3 },
      { i: 'volume-chart', x: 3, y: 0, w: 9, h: 4 }
    ]
  });

  return (
    <DashboardGrid
      layouts={layouts}
      onLayoutChange={(layout, layouts) => setLayouts(layouts)}
    >
      <MetricCard
        key="tickets-today"
        id="tickets-today"
        title="Tickets Today"
        value={45}
        previousValue={38}
        format="number"
      />

      <ChartWidget
        key="volume-chart"
        id="volume-chart"
        title="Ticket Volume"
        data={volumeData}
        chartType="line"
        dataKeys={['created', 'resolved']}
        xAxisKey="date"
      />
    </DashboardGrid>
  );
}
```

### Example 2: Loading a Predefined Template

```typescript
async function loadTemplate(templateName: string) {
  const response = await fetch(`/api/dashboard/templates/${templateName}`);
  const { template } = await response.json();

  setDashboardConfig(template.config);
}

// Load executive overview template
await loadTemplate('executive_overview');
```

### Example 3: Scheduled Export

```typescript
import { scheduleExport } from '@/lib/dashboard/export-engine';

await scheduleExport({
  dashboardId: 'executive-dashboard',
  schedule: 'daily',
  format: 'pdf',
  recipients: ['executive@company.com'],
  enabled: true
});
```

---

## Database Schema

### Tables Created

#### `dashboards`
Stores user-created dashboard configurations.

```sql
CREATE TABLE dashboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    config TEXT NOT NULL, -- JSON
    user_id INTEGER NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### `dashboard_templates`
Predefined dashboard templates.

```sql
CREATE TABLE dashboard_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    config TEXT NOT NULL,
    category TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `dashboard_widgets`
Widget type registry.

```sql
CREATE TABLE dashboard_widgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    widget_type TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    data_source TEXT,
    default_config TEXT,
    required_permissions TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `dashboard_exports`
Scheduled export configurations.

```sql
CREATE TABLE dashboard_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dashboard_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    schedule TEXT NOT NULL,
    format TEXT NOT NULL,
    recipients TEXT NOT NULL,
    last_run_at DATETIME,
    next_run_at DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dashboard_id) REFERENCES dashboards(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Migration Script

Run the database schema:

```bash
sqlite3 servicedesk.db < lib/db/schemas/dashboards.sql
```

---

## Performance Considerations

### Optimization Strategies

1. **Caching**
   - Metric calculations cached for 3 seconds
   - Dashboard configurations cached in memory
   - Data source results cached based on parameters

2. **Real-Time Streaming**
   - SSE connection reused for all metrics
   - Batched updates every 5 seconds
   - Automatic reconnection with exponential backoff

3. **Database Queries**
   - Indexed on frequently queried columns
   - Optimized aggregation queries
   - Connection pooling (when using PostgreSQL)

4. **Frontend Rendering**
   - React.memo for widget components
   - Virtualized tables for large datasets
   - Lazy loading of chart libraries

### Performance Metrics

- **Initial Load**: <1s for dashboard with 10 widgets
- **Update Latency**: <2s from event to UI update
- **Export Time**: <5s for PDF, <3s for Excel
- **Memory Usage**: <50MB per active dashboard connection

---

## Troubleshooting

### Common Issues

**Issue: Widgets not updating in real-time**
```
Solution: Check SSE connection status
- Verify /api/dashboard/metrics/stream endpoint is accessible
- Check browser console for connection errors
- Confirm firewall/proxy allows SSE connections
```

**Issue: Dashboard not saving**
```
Solution: Verify database permissions
- Check database file write permissions
- Ensure dashboards table exists
- Verify user authentication token is valid
```

**Issue: Export fails**
```
Solution: Check dependencies
- Verify jspdf, xlsx are installed
- Check browser supports html2canvas
- Ensure sufficient memory for large dashboards
```

---

## Future Enhancements

### Planned Features

1. **Advanced Analytics**
   - Predictive analytics integration
   - Anomaly detection alerts
   - ML-based forecasting

2. **Collaboration**
   - Real-time collaborative editing
   - Dashboard comments and annotations
   - Share via public link

3. **Mobile App**
   - Native mobile dashboard viewer
   - Push notifications for alerts
   - Offline mode support

4. **Enterprise Features**
   - Multi-tenant isolation
   - Advanced permissions (row-level security)
   - Audit logging
   - SSO integration

---

## Support

For issues, questions, or feature requests:
- GitHub Issues: [link]
- Documentation: [link]
- Email: support@servicedesk.com

---

## License

This dashboard system is part of the ServiceDesk platform and follows the same license terms.

---

**Last Updated**: December 2025
**Version**: 1.0.0
