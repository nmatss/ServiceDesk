'use client';

import React, { ReactNode } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export interface DashboardGridProps {
  layouts: { [key: string]: Layout[] };
  onLayoutChange?: (layout: Layout[], layouts: { [key: string]: Layout[] }) => void;
  onBreakpointChange?: (breakpoint: string) => void;
  isDraggable?: boolean;
  isResizable?: boolean;
  children: ReactNode;
  rowHeight?: number;
  breakpoints?: { [key: string]: number };
  cols?: { [key: string]: number };
  margin?: [number, number];
  containerPadding?: [number, number];
}

export function DashboardGrid({
  layouts,
  onLayoutChange,
  onBreakpointChange,
  isDraggable = true,
  isResizable = true,
  children,
  rowHeight = 60,
  breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 },
  cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 },
  margin = [16, 16],
  containerPadding = [0, 0]
}: DashboardGridProps) {
  return (
    <ResponsiveGridLayout
      className="dashboard-grid"
      layouts={layouts}
      breakpoints={breakpoints}
      cols={cols}
      rowHeight={rowHeight}
      onLayoutChange={onLayoutChange}
      onBreakpointChange={onBreakpointChange}
      isDraggable={isDraggable}
      isResizable={isResizable}
      margin={margin}
      containerPadding={containerPadding}
      useCSSTransforms={true}
      compactType="vertical"
      preventCollision={false}
      draggableHandle=".widget-drag-handle"
    >
      {children}
    </ResponsiveGridLayout>
  );
}
