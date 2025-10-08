'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, SankeyNode, SankeyLink } from 'd3-sankey';

interface SankeyData {
  nodes: Array<{
    id: string;
    name: string;
    category?: string;
    value?: number;
  }>;
  links: Array<{
    source: string;
    target: string;
    value: number;
    type?: string;
  }>;
}

interface SankeyDiagramsProps {
  data: SankeyData;
  type: 'workflow' | 'ticket_flow' | 'agent_assignment';
  width?: number;
  height?: number;
  onNodeClick?: (node: any) => void;
  onLinkClick?: (link: any) => void;
}

// Workflow Analysis Sankey
export function WorkflowSankey({
  data,
  width = 900,
  height = 500,
  onNodeClick,
  onLinkClick
}: {
  data: SankeyData;
  width?: number;
  height?: number;
  onNodeClick?: (node: any) => void;
  onLinkClick?: (link: any) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [selectedLink, setSelectedLink] = useState<any>(null);

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare data for d3-sankey
    const nodeMap = new Map();
    data.nodes.forEach((node, i) => {
      nodeMap.set(node.id, { ...node, index: i });
    });

    const sankeyData = {
      nodes: data.nodes.map((node, i) => ({ ...node, index: i })),
      links: data.links.map(link => ({
        ...link,
        source: data.nodes.findIndex(n => n.id === link.source),
        target: data.nodes.findIndex(n => n.id === link.target)
      }))
    };

    // Create sankey generator
    const sankeyGenerator = sankey<any, any>()
      .nodeWidth(15)
      .nodePadding(10)
      .extent([[1, 1], [innerWidth - 1, innerHeight - 6]]);

    const { nodes, links } = sankeyGenerator(sankeyData);

    // Color scales
    const nodeColorScale = d3
      .scaleOrdinal()
      .domain(['open', 'in_progress', 'resolved', 'closed', 'escalated'])
      .range(['#3B82F6', '#F59E0B', '#10B981', '#6B7280', '#EF4444']);

    const linkColorScale = d3
      .scaleSequential()
      .domain([0, d3.max(links, d => d.value) || 0])
      .interpolator(d3.interpolateBlues);

    // Create links
    const linkGroup = g
      .append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => linkColorScale(d.value))
      .attr('stroke-width', d => Math.max(1, d.width || 0))
      .attr('fill', 'none')
      .attr('opacity', 0.7)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke-width', (d.width || 0) + 2);

        // Show tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'sankey-tooltip')
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

        const sourceNode = d.source as SankeyNode<any, any>;
        const targetNode = d.target as SankeyNode<any, any>;

        tooltip
          .html(`
            <strong>Flow</strong><br/>
            From: ${sourceNode.name}<br/>
            To: ${targetNode.name}<br/>
            Volume: ${d.value} tickets<br/>
            ${d.type ? `Type: ${d.type}` : ''}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('opacity', 0.7)
          .attr('stroke-width', d.width || 0);

        d3.selectAll('.sankey-tooltip').remove();
      })
      .on('click', function(event, d) {
        setSelectedLink(d);
        if (onLinkClick) {
          onLinkClick(d);
        }
      });

    // Create nodes
    const nodeGroup = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('rect')
      .data(nodes)
      .enter()
      .append('rect')
      .attr('x', d => d.x0 || 0)
      .attr('y', d => d.y0 || 0)
      .attr('height', d => (d.y1 || 0) - (d.y0 || 0))
      .attr('width', d => (d.x1 || 0) - (d.x0 || 0))
      .attr('fill', d => nodeColorScale(d.category || d.name))
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke-width', 3);

        // Highlight connected links
        linkGroup
          .attr('opacity', link => {
            const isConnected = link.source === d || link.target === d;
            return isConnected ? 1 : 0.3;
          });

        // Show tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'sankey-node-tooltip')
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
            <strong>${d.name}</strong><br/>
            ${d.category ? `Category: ${d.category}<br/>` : ''}
            Value: ${d.value || 0}<br/>
            Incoming: ${d.targetLinks?.reduce((sum, link) => sum + link.value, 0) || 0}<br/>
            Outgoing: ${d.sourceLinks?.reduce((sum, link) => sum + link.value, 0) || 0}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        d3.select(this)
          .attr('stroke-width', 1);

        linkGroup.attr('opacity', 0.7);
        d3.selectAll('.sankey-node-tooltip').remove();
      })
      .on('click', function(event, d) {
        setSelectedNode(d);
        if (onNodeClick) {
          onNodeClick(d);
        }
      });

    // Add node labels
    g.append('g')
      .attr('class', 'node-labels')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('x', d => (d.x0 || 0) < innerWidth / 2 ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', d => ((d.y1 || 0) + (d.y0 || 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => (d.x0 || 0) < innerWidth / 2 ? 'start' : 'end')
      .style('font-size', '12px')
      .style('fill', '#374151')
      .style('font-weight', 'bold')
      .text(d => d.name);

    // Add value labels for nodes
    g.append('g')
      .attr('class', 'node-values')
      .selectAll('text')
      .data(nodes.filter(d => d.value))
      .enter()
      .append('text')
      .attr('x', d => (d.x0 || 0) < innerWidth / 2 ? (d.x1 || 0) + 6 : (d.x0 || 0) - 6)
      .attr('y', d => ((d.y1 || 0) + (d.y0 || 0)) / 2 + 15)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => (d.x0 || 0) < innerWidth / 2 ? 'start' : 'end')
      .style('font-size', '10px')
      .style('fill', '#6B7280')
      .text(d => `(${d.value})`);

    // Add link value labels for major flows
    g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(links.filter(d => d.value > (d3.max(links, l => l.value) || 0) * 0.1))
      .enter()
      .append('text')
      .attr('x', d => {
        const sourceNode = d.source as SankeyNode<any, any>;
        const targetNode = d.target as SankeyNode<any, any>;
        return ((sourceNode.x1 || 0) + (targetNode.x0 || 0)) / 2;
      })
      .attr('y', d => {
        const sourceNode = d.source as SankeyNode<any, any>;
        const targetNode = d.target as SankeyNode<any, any>;
        return ((sourceNode.y0 || 0) + (sourceNode.y1 || 0) + (targetNode.y0 || 0) + (targetNode.y1 || 0)) / 4;
      })
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .style('font-size', '10px')
      .style('fill', '#374151')
      .style('font-weight', 'bold')
      .text(d => d.value);

  }, [data, width, height, onNodeClick, onLinkClick]);

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Ticket Workflow Analysis
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Visualizing ticket flow through different stages and processes
        </p>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      />

      {/* Selection Information */}
      {(selectedNode || selectedLink) && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          {selectedNode && (
            <div>
              <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                Selected Node: {selectedNode.name}
              </h4>
              <p className="text-blue-600 dark:text-blue-300">
                {selectedNode.category && `Category: ${selectedNode.category} | `}
                Value: {selectedNode.value || 0}
              </p>
            </div>
          )}
          {selectedLink && (
            <div>
              <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                Selected Flow
              </h4>
              <p className="text-blue-600 dark:text-blue-300">
                From: {(selectedLink.source as any).name} → To: {(selectedLink.target as any).name} |
                Volume: {selectedLink.value}
                {selectedLink.type && ` | Type: ${selectedLink.type}`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Open</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">In Progress</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Resolved</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-gray-500 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Closed</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">Escalated</span>
        </div>
      </div>
    </div>
  );
}

// Ticket Flow Sankey (simplified version)
export function TicketFlowSankey({
  data,
  width = 800,
  height = 400
}: {
  data: SankeyData;
  width?: number;
  height?: number;
}) {
  return (
    <WorkflowSankey
      data={data}
      width={width}
      height={height}
    />
  );
}

// Agent Assignment Flow
export function AgentAssignmentSankey({
  data,
  width = 700,
  height = 400
}: {
  data: SankeyData;
  width?: number;
  height?: number;
}) {
  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Agent Assignment Flow
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          How tickets are distributed and reassigned among agents
        </p>
      </div>

      <WorkflowSankey
        data={data}
        width={width}
        height={height}
      />
    </div>
  );
}

// Main Sankey Diagrams Component
export function SankeyDiagrams({
  data,
  type,
  width = 900,
  height = 500,
  onNodeClick,
  onLinkClick
}: SankeyDiagramsProps) {
  switch (type) {
    case 'workflow':
      return (
        <WorkflowSankey
          data={data}
          width={width}
          height={height}
          onNodeClick={onNodeClick}
          onLinkClick={onLinkClick}
        />
      );

    case 'ticket_flow':
      return (
        <TicketFlowSankey
          data={data}
          width={width}
          height={height}
        />
      );

    case 'agent_assignment':
      return (
        <AgentAssignmentSankey
          data={data}
          width={width}
          height={height}
        />
      );

    default:
      return (
        <WorkflowSankey
          data={data}
          width={width}
          height={height}
          onNodeClick={onNodeClick}
          onLinkClick={onLinkClick}
        />
      );
  }
}