'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Brush,
  ReferenceLine,
  ReferenceArea
} from 'recharts';

interface InteractiveChartsProps {
  data: any[];
  chartType: 'drilldown' | 'zoomable' | 'brushable' | 'clickable';
  onDrillDown?: (data: any) => void;
  onZoom?: (domain: [number, number]) => void;
  onBrush?: (domain: [number, number]) => void;
  onClick?: (data: any) => void;
  width?: number;
  height?: number;
}

// D3.js Drilldown Chart Component
export function DrilldownChart({
  data,
  onDrillDown,
  width = 800,
  height = 400
}: {
  data: any[];
  onDrillDown?: (data: any) => void;
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [breadcrumb, setBreadcrumb] = useState<string[]>(['Overview']);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 40 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const xScale = d3
      .scaleBand()
      .domain(data.map(d => d.name))
      .range([0, innerWidth])
      .padding(0.1);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 0])
      .range([innerHeight, 0]);

    // Color scale
    const colorScale = d3
      .scaleOrdinal()
      .domain(data.map(d => d.name))
      .range(d3.schemeCategory10);

    // Create bars
    const bars = g
      .selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.name) || 0)
      .attr('y', d => yScale(d.value))
      .attr('width', xScale.bandwidth())
      .attr('height', d => innerHeight - yScale(d.value))
      .attr('fill', d => colorScale(d.name) as string)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 0.8);

        // Show tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0);

        tooltip
          .transition()
          .duration(200)
          .style('opacity', 1);

        tooltip
          .html(`<strong>${d.name}</strong><br/>Value: ${d.value}`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('opacity', 1);

        d3.selectAll('.tooltip').remove();
      })
      .on('click', function(event, d) {
        if (d.children && onDrillDown) {
          onDrillDown(d);
          setCurrentLevel(prev => prev + 1);
          setBreadcrumb(prev => [...prev, d.name]);
        }
      });

    // Add animations
    bars
      .attr('height', 0)
      .attr('y', innerHeight)
      .transition()
      .duration(800)
      .delay((d, i) => i * 100)
      .attr('height', d => innerHeight - yScale(d.value))
      .attr('y', d => yScale(d.value));

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

    // Add labels
    g.selectAll('.value-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'value-label')
      .attr('x', d => (xScale(d.name) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.value) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#374151')
      .style('opacity', 0)
      .text(d => d.value)
      .transition()
      .delay(800)
      .duration(400)
      .style('opacity', 1);

  }, [data, width, height, onDrillDown]);

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <nav className="flex mb-4" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-3">
          {breadcrumb.map((crumb, index) => (
            <li key={index} className="inline-flex items-center">
              {index > 0 && (
                <svg className="w-3 h-3 mx-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`text-sm font-medium ${
                index === breadcrumb.length - 1
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer'
              }`}>
                {crumb}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      />
    </div>
  );
}

// Zoomable Chart with Recharts
export function ZoomableChart({
  data,
  onZoom
}: {
  data: any[];
  onZoom?: (domain: [number, number]) => void;
}) {
  const [left, setLeft] = useState<number | undefined>();
  const [right, setRight] = useState<number | undefined>();
  const [refAreaLeft, setRefAreaLeft] = useState<string | number>('');
  const [refAreaRight, setRefAreaRight] = useState<string | number>('');
  const [top, setTop] = useState<number | undefined>();
  const [bottom, setBottom] = useState<number | undefined>();

  const handleMouseDown = (e: any) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
    }
  };

  const handleMouseMove = (e: any) => {
    if (refAreaLeft && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  };

  const handleMouseUp = () => {
    if (refAreaLeft && refAreaRight) {
      let leftIndex = data.findIndex(item => item.name === refAreaLeft);
      let rightIndex = data.findIndex(item => item.name === refAreaRight);

      if (leftIndex > rightIndex) {
        [leftIndex, rightIndex] = [rightIndex, leftIndex];
      }

      const newLeft = leftIndex;
      const newRight = rightIndex;

      setLeft(newLeft);
      setRight(newRight);

      if (onZoom) {
        onZoom([newLeft, newRight]);
      }
    }

    setRefAreaLeft('');
    setRefAreaRight('');
  };

  const resetZoom = () => {
    setLeft(undefined);
    setRight(undefined);
    setTop(undefined);
    setBottom(undefined);
    setRefAreaLeft('');
    setRefAreaRight('');
  };

  const zoomedData = left !== undefined && right !== undefined
    ? data.slice(left, right + 1)
    : data;

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Zoomable Time Series Chart
        </h3>
        <button
          onClick={resetZoom}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Reset Zoom
        </button>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart
          data={zoomedData}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[bottom || 'dataMin', top || 'dataMax']} />
          <Tooltip />
          <Legend />

          <Bar dataKey="value" fill="#3B82F6" />
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
          />

          {refAreaLeft && refAreaRight && (
            <ReferenceArea
              x1={refAreaLeft}
              x2={refAreaRight}
              strokeOpacity={0.3}
              fillOpacity={0.1}
              fill="#3B82F6"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <p>💡 Tip: Click and drag on the chart to zoom into a specific time range</p>
      </div>
    </div>
  );
}

// Brushable Chart for Overview + Detail
export function BrushableChart({
  data,
  onBrush
}: {
  data: any[];
  onBrush?: (domain: [number, number]) => void;
}) {
  const [brushDomain, setBrushDomain] = useState<[number, number]>([0, data.length - 1]);

  const handleBrushChange = (domain: any) => {
    if (domain && domain.startIndex !== undefined && domain.endIndex !== undefined) {
      const newDomain: [number, number] = [domain.startIndex, domain.endIndex];
      setBrushDomain(newDomain);
      if (onBrush) {
        onBrush(newDomain);
      }
    }
  };

  const detailData = data.slice(brushDomain[0], brushDomain[1] + 1);

  return (
    <div className="w-full space-y-6">
      {/* Detail View */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Detail View
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={detailData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#3B82F6" />
            <Line
              type="monotone"
              dataKey="trend"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Overview with Brush */}
      <div>
        <h4 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-2">
          Overview & Navigation
        </h4>
        <ResponsiveContainer width="100%" height={100}>
          <ComposedChart data={data}>
            <XAxis dataKey="name" hide />
            <YAxis hide />
            <Bar dataKey="value" fill="#94A3B8" />
            <Brush
              dataKey="name"
              height={30}
              stroke="#3B82F6"
              onChange={handleBrushChange}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Main Interactive Charts Component
export function InteractiveCharts({
  data,
  chartType,
  onDrillDown,
  onZoom,
  onBrush,
  onClick,
  width = 800,
  height = 400
}: InteractiveChartsProps) {
  switch (chartType) {
    case 'drilldown':
      return (
        <DrilldownChart
          data={data}
          onDrillDown={onDrillDown}
          width={width}
          height={height}
        />
      );

    case 'zoomable':
      return <ZoomableChart data={data} onZoom={onZoom} />;

    case 'brushable':
      return <BrushableChart data={data} onBrush={onBrush} />;

    case 'clickable':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} onClick={onClick}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#3B82F6" />
          </ComposedChart>
        </ResponsiveContainer>
      );

    default:
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#3B82F6" />
          </ComposedChart>
        </ResponsiveContainer>
      );
  }
}