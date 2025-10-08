'use client';

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

interface NetworkNode {
  id: string;
  name: string;
  type: 'agent' | 'supervisor' | 'department' | 'ticket';
  value?: number;
  group?: string;
  metadata?: any;
}

interface NetworkLink {
  source: string;
  target: string;
  value: number;
  type?: 'collaboration' | 'escalation' | 'assignment' | 'communication';
  strength?: number;
}

interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

interface NetworkGraphsProps {
  data: NetworkData;
  type: 'collaboration' | 'escalation' | 'communication';
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
  onLinkClick?: (link: NetworkLink) => void;
}

// Agent Collaboration Network
export function AgentCollaborationNetwork({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  onLinkClick
}: {
  data: NetworkData;
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
  onLinkClick?: (link: NetworkLink) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);

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

    // Create force simulation
    const simulation = d3
      .forceSimulation(data.nodes as any)
      .force('link', d3.forceLink(data.links).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(innerWidth / 2, innerHeight / 2))
      .force('collision', d3.forceCollide().radius(30));

    // Color scales
    const nodeColorScale = d3
      .scaleOrdinal()
      .domain(['agent', 'supervisor', 'department', 'ticket'])
      .range(['#3B82F6', '#10B981', '#F59E0B', '#EF4444']);

    const linkColorScale = d3
      .scaleOrdinal()
      .domain(['collaboration', 'escalation', 'assignment', 'communication'])
      .range(['#3B82F6', '#EF4444', '#10B981', '#8B5CF6']);

    // Size scale for nodes
    const nodeSizeScale = d3
      .scaleLinear()
      .domain([0, d3.max(data.nodes, d => d.value || 0) || 0])
      .range([5, 25]);

    // Link width scale
    const linkWidthScale = d3
      .scaleLinear()
      .domain([0, d3.max(data.links, d => d.value) || 0])
      .range([1, 8]);

    // Create links
    const links = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', d => linkColorScale(d.type || 'collaboration'))
      .attr('stroke-width', d => linkWidthScale(d.value))
      .attr('stroke-opacity', 0.6)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', linkWidthScale(d.value) + 2);

        // Show tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'network-link-tooltip')
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
            <strong>${d.type?.toUpperCase() || 'COLLABORATION'}</strong><br/>
            From: ${(d.source as any).name || d.source}<br/>
            To: ${(d.target as any).name || d.target}<br/>
            Strength: ${d.value}<br/>
            ${d.strength ? `Quality: ${d.strength}%` : ''}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', linkWidthScale(d.value));

        d3.selectAll('.network-link-tooltip').remove();
      })
      .on('click', function(event, d) {
        if (onLinkClick) {
          onLinkClick(d);
        }
      });

    // Create nodes
    const nodes = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(data.nodes)
      .enter()
      .append('circle')
      .attr('r', d => nodeSizeScale(d.value || 0))
      .attr('fill', d => nodeColorScale(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, NetworkNode>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }))
      .on('mouseover', function(event, d) {
        setHoveredNode(d);

        d3.select(this)
          .attr('stroke-width', 4)
          .attr('r', nodeSizeScale(d.value || 0) + 3);

        // Highlight connected links
        links
          .attr('stroke-opacity', link => {
            const isConnected = (link.source as any).id === d.id || (link.target as any).id === d.id;
            return isConnected ? 1 : 0.2;
          })
          .attr('stroke-width', link => {
            const isConnected = (link.source as any).id === d.id || (link.target as any).id === d.id;
            return isConnected ? linkWidthScale(link.value) + 2 : linkWidthScale(link.value);
          });

        // Highlight connected nodes
        nodes
          .attr('fill-opacity', node => {
            if (node.id === d.id) return 1;
            const isConnected = data.links.some(link =>
              (link.source === d.id && link.target === node.id) ||
              (link.target === d.id && link.source === node.id)
            );
            return isConnected ? 1 : 0.3;
          });

        // Show tooltip
        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'network-node-tooltip')
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

        const connections = data.links.filter(link =>
          (link.source as any).id === d.id || (link.target as any).id === d.id
        ).length;

        tooltip
          .html(`
            <strong>${d.name}</strong><br/>
            Type: ${d.type}<br/>
            ${d.group ? `Group: ${d.group}<br/>` : ''}
            Value: ${d.value || 0}<br/>
            Connections: ${connections}<br/>
            ${d.metadata ? `Department: ${d.metadata.department || 'N/A'}` : ''}
          `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', function() {
        setHoveredNode(null);

        d3.select(this)
          .attr('stroke-width', 2)
          .attr('r', d => nodeSizeScale(d.value || 0));

        // Reset link styling
        links
          .attr('stroke-opacity', 0.6)
          .attr('stroke-width', d => linkWidthScale(d.value));

        // Reset node styling
        nodes.attr('fill-opacity', 1);

        d3.selectAll('.network-node-tooltip').remove();
      })
      .on('click', function(event, d) {
        setSelectedNode(d);
        if (onNodeClick) {
          onNodeClick(d);
        }
      });

    // Add labels
    const labels = g
      .append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(data.nodes)
      .enter()
      .append('text')
      .attr('dy', 3)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#374151')
      .style('font-weight', 'bold')
      .style('pointer-events', 'none')
      .text(d => d.name.length > 10 ? d.name.substring(0, 8) + '...' : d.name);

    // Update positions on simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      labels
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y);
    });

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Add controls
    const controls = svg
      .append('g')
      .attr('class', 'controls')
      .attr('transform', `translate(${width - 100}, 30)`);

    controls
      .append('rect')
      .attr('width', 80)
      .attr('height', 60)
      .attr('fill', 'rgba(255, 255, 255, 0.9)')
      .attr('stroke', '#ccc')
      .attr('rx', 4);

    controls
      .append('text')
      .attr('x', 40)
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .text('Controls');

    controls
      .append('text')
      .attr('x', 40)
      .attr('y', 35)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('cursor', 'pointer')
      .text('Reset Zoom')
      .on('click', () => {
        svg.transition().duration(750).call(
          zoom.transform,
          d3.zoomIdentity
        );
      });

    controls
      .append('text')
      .attr('x', 40)
      .attr('y', 50)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('cursor', 'pointer')
      .text('Restart')
      .on('click', () => {
        simulation.alpha(1).restart();
      });

    return () => {
      simulation.stop();
    };

  }, [data, width, height, onNodeClick, onLinkClick]);

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Agent Collaboration Network
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Interactive network showing collaboration patterns between team members
        </p>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"
      />

      {/* Selection Information */}
      {selectedNode && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200">
            Selected: {selectedNode.name}
          </h4>
          <div className="grid grid-cols-2 gap-4 mt-2 text-sm text-blue-600 dark:text-blue-300">
            <div>Type: {selectedNode.type}</div>
            <div>Value: {selectedNode.value || 0}</div>
            {selectedNode.group && <div>Group: {selectedNode.group}</div>}
            {selectedNode.metadata?.department && <div>Department: {selectedNode.metadata.department}</div>}
          </div>
        </div>
      )}

      {/* Network Statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {data.nodes.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Nodes</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {data.links.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Connections</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {(data.links.reduce((sum, link) => sum + link.value, 0) / data.links.length).toFixed(1)}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Avg Strength</div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {Math.max(...data.nodes.map(node =>
              data.links.filter(link =>
                (link.source as any).id === node.id || (link.target as any).id === node.id
              ).length
            ))}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Max Connections</div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Legend</h4>
        <div className="flex flex-wrap gap-4">
          {/* Node Types */}
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Agent</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Supervisor</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Department</span>
          </div>

          {/* Link Types */}
          <div className="flex items-center space-x-2 ml-6">
            <div className="w-6 h-1 bg-blue-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Collaboration</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-1 bg-red-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Escalation</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-1 bg-green-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Assignment</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-6 h-1 bg-purple-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Communication</span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        💡 Tip: Drag nodes to rearrange, zoom with mouse wheel, hover for details
      </div>
    </div>
  );
}

// Main Network Graphs Component
export function NetworkGraphs({
  data,
  type,
  width = 800,
  height = 600,
  onNodeClick,
  onLinkClick
}: NetworkGraphsProps) {
  switch (type) {
    case 'collaboration':
      return (
        <AgentCollaborationNetwork
          data={data}
          width={width}
          height={height}
          onNodeClick={onNodeClick}
          onLinkClick={onLinkClick}
        />
      );

    case 'escalation':
      return (
        <div className="w-full">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Escalation Network
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Network showing escalation patterns and hierarchies
            </p>
          </div>
          <AgentCollaborationNetwork
            data={data}
            width={width}
            height={height}
            onNodeClick={onNodeClick}
            onLinkClick={onLinkClick}
          />
        </div>
      );

    case 'communication':
      return (
        <div className="w-full">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Communication Network
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Communication patterns and information flow between team members
            </p>
          </div>
          <AgentCollaborationNetwork
            data={data}
            width={width}
            height={height}
            onNodeClick={onNodeClick}
            onLinkClick={onLinkClick}
          />
        </div>
      );

    default:
      return (
        <AgentCollaborationNetwork
          data={data}
          width={width}
          height={height}
          onNodeClick={onNodeClick}
          onLinkClick={onLinkClick}
        />
      );
  }
}