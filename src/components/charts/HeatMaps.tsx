'use client';

import React, { useRef, useEffect, useState } from 'react';
// Optimize D3 imports: only import specific functions instead of entire library
import { select, selectAll } from 'd3-selection';
import { scaleBand, scaleLinear, scaleSequential } from 'd3-scale';
import { max, min, extent } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { interpolateRdYlGn, interpolateYlOrRd } from 'd3-scale-chromatic';

// Create d3 namespace for easier refactoring
const d3 = {
  select,
  selectAll,
  scaleBand,
  scaleLinear,
  scaleSequential,
  max,
  min,
  extent,
  axisBottom,
  axisLeft,
  interpolateRdYlGn,
  interpolateYlOrRd
};

interface HeatMapData {
  hour: number;
  day: string;
  value: number;
  department?: string;
}

interface HeatMapsProps {
  data: HeatMapData[];
  type: 'hourly' | 'department' | 'agent';
  width?: number;
  height?: number;
  onCellClick?: (data: HeatMapData) => void;
}

// Performance by Hour/Day Heatmap
export function HourlyPerformanceHeatMap({
  data,
  width = 800,
  height = 300,
  onCellClick
}: {
  data: HeatMapData[];
  width?: number;
  height?: number;
  onCellClick?: (data: HeatMapData) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedCell, setSelectedCell] = useState<HeatMapData | null>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 50, right: 80, bottom: 50, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Get unique days and hours
    const days = Array.from(new Set(data.map(d => d.day)));
    const hours = Array.from(new Set(data.map(d => d.hour))).sort((a, b) => a - b);

    // Create scales
    const xScale = d3
      .scaleBand()
      .domain(hours.map(h => h.toString()))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3
      .scaleBand()
      .domain(days)
      .range([0, innerHeight])
      .padding(0.1);

    // Color scale
    const colorScale = d3
      .scaleSequential()
      .interpolator(d3.interpolateBlues)
      .domain([0, d3.max(data, d => d.value) || 0]);

    // Create cells
    g
      .selectAll('.cell')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('x', d => xScale(d.hour.toString()) || 0)
      .attr('y', d => yScale(d.day) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.value))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#000')
          .attr('stroke-width', 2);

        // Show tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'heatmap-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', 'white')
          .style('padding', '12px')
          .style('border-radius', '6px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .style('opacity', 0);

        tooltip
          .transition()
          .duration(200)
          .style('opacity', 1);

        tooltip
          .html(`
            <strong>${d.day}</strong><br/>
            Hour: ${d.hour}:00<br/>
            ${d.department ? `Department: ${d.department}<br/>` : ''}
            Value: ${d.value}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);

        d3.selectAll('.heatmap-tooltip').remove();
      })
      .on('click', function(_event, d) {
        setSelectedCell(d);
        if (onCellClick) {
          onCellClick(d);
        }
      });

    // Add text labels
    g.selectAll('.cell-text')
      .data(data.filter(d => d.value > 0))
      .enter()
      .append('text')
      .attr('class', 'cell-text')
      .attr('x', d => (xScale(d.hour.toString()) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => (yScale(d.day) || 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '10px')
      .style('fill', d => d.value > (d3.max(data, d => d.value) || 0) * 0.6 ? 'white' : 'black')
      .style('pointer-events', 'none')
      .text(d => d.value);

    // Create axes
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#6B7280');

    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#6B7280');

    // Add axis labels
    g.append('text')
      .attr('transform', `translate(${innerWidth / 2}, ${innerHeight + 40})`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#374151')
      .text('Hour of Day');

    g.append('text')
      .attr('transform', `translate(-60, ${innerHeight / 2}) rotate(-90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#374151')
      .text('Day of Week');

    // Create color legend
    const legendWidth = 200;
    const legendHeight = 20;

    const legend = svg
      .append('g')
      .attr('transform', `translate(${width - legendWidth - 20}, 20)`);

    const legendScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 0])
      .range([0, legendWidth]);

    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(5);

    // Create gradient
    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    gradient
      .selectAll('stop')
      .data(d3.range(0, 1.01, 0.1))
      .enter()
      .append('stop')
      .attr('offset', d => `${d * 100}%`)
      .attr('stop-color', d => d3.interpolateBlues(d));

    legend
      .append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#legend-gradient)');

    legend
      .append('g')
      .attr('transform', `translate(0, ${legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '10px')
      .style('fill', '#6B7280');

    legend
      .append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -5)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#374151')
      .text('Ticket Volume');

  }, [data, width, height, onCellClick]);

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Performance Heatmap by Hour and Day
        </h3>
        <p className="text-sm text-description">
          Click on cells to view detailed information
        </p>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      />

      {selectedCell && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200">
            Selected: {selectedCell.day} at {selectedCell.hour}:00
          </h4>
          <p className="text-blue-600 dark:text-blue-300">
            Value: {selectedCell.value}
            {selectedCell.department && ` | Department: ${selectedCell.department}`}
          </p>
        </div>
      )}
    </div>
  );
}

// Department Performance Heatmap
export function DepartmentHeatMap({
  data,
  width = 600,
  height = 400
}: {
  data: HeatMapData[];
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 50, right: 100, bottom: 50, left: 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Process data for department view
    const departments = Array.from(new Set(data.map(d => d.department).filter(Boolean))) as string[];
    const metrics = ['Volume', 'Avg Response Time', 'Satisfaction', 'Resolution Rate'];

    // Create mock data for departments and metrics
    const heatmapData = departments.flatMap(dept =>
      metrics.map((metric) => ({
        department: dept,
        metric,
        value: Math.random() * 100 // Replace with actual metric calculation
      }))
    );

    // Create scales
    const xScale = d3
      .scaleBand()
      .domain(metrics)
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3
      .scaleBand()
      .domain(departments)
      .range([0, innerHeight])
      .padding(0.1);

    const colorScale = d3
      .scaleSequential()
      .interpolator(d3.interpolateViridis)
      .domain([0, 100]);

    // Create cells
    g.selectAll('.dept-cell')
      .data(heatmapData)
      .enter()
      .append('rect')
      .attr('class', 'dept-cell')
      .attr('x', d => xScale(d.metric) || 0)
      .attr('y', d => yScale(d.department) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.value))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#000')
          .attr('stroke-width', 2);

        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'dept-tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', 'white')
          .style('padding', '12px')
          .style('border-radius', '6px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '1000')
          .style('opacity', 0);

        tooltip
          .transition()
          .duration(200)
          .style('opacity', 1);

        tooltip
          .html(`
            <strong>${d.department}</strong><br/>
            ${d.metric}: ${d.value.toFixed(1)}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1);

        d3.selectAll('.dept-tooltip').remove();
      });

    // Add text labels
    g.selectAll('.dept-text')
      .data(heatmapData)
      .enter()
      .append('text')
      .attr('class', 'dept-text')
      .attr('x', d => (xScale(d.metric) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => (yScale(d.department) || 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '10px')
      .style('fill', 'white')
      .style('pointer-events', 'none')
      .text(d => d.value.toFixed(0));

    // Create axes
    g.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#6B7280')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    g.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('font-size', '12px')
      .style('fill', '#6B7280');

  }, [data, width, height]);

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Department Performance Matrix
        </h3>
        <p className="text-sm text-description">
          Performance metrics across different departments
        </p>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      />
    </div>
  );
}

// Main HeatMaps Component
export function HeatMaps({
  data,
  type,
  width = 800,
  height = 400,
  onCellClick
}: HeatMapsProps) {
  switch (type) {
    case 'hourly':
      return (
        <HourlyPerformanceHeatMap
          data={data}
          width={width}
          height={height}
          onCellClick={onCellClick}
        />
      );

    case 'department':
      return (
        <DepartmentHeatMap
          data={data}
          width={width}
          height={height}
        />
      );

    case 'agent':
      // Implementation for agent performance heatmap
      return (
        <HourlyPerformanceHeatMap
          data={data}
          width={width}
          height={height}
          onCellClick={onCellClick}
        />
      );

    default:
      return (
        <HourlyPerformanceHeatMap
          data={data}
          width={width}
          height={height}
          onCellClick={onCellClick}
        />
      );
  }
}