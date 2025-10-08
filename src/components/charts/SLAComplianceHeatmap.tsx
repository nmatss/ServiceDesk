/**
 * SLA Compliance Heatmap Component
 *
 * Interactive heatmap showing SLA compliance by time of day and day of week
 * Features customizable color scales and detailed tooltips
 */

'use client';

import { useState, useMemo } from 'react';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SLAHeatmapData {
  hour: number;
  day: number; // 0 = Sunday, 6 = Saturday
  compliance_rate: number; // 0-100
  total_tickets: number;
  violated_tickets: number;
  avg_response_time?: number;
}

export type ColorScale = 'default' | 'red-green' | 'blue-yellow' | 'grayscale';

export interface SLAComplianceHeatmapProps {
  data: SLAHeatmapData[];
  colorScale?: ColorScale;
  showValues?: boolean;
  showTooltip?: boolean;
  height?: number;
  onCellClick?: (hour: number, day: number) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const COLOR_SCALES: Record<ColorScale, (value: number) => string> = {
  default: (value: number) => {
    if (value >= 95) return '#10b981'; // green-500
    if (value >= 90) return '#84cc16'; // lime-500
    if (value >= 80) return '#fbbf24'; // yellow-400
    if (value >= 70) return '#fb923c'; // orange-400
    return '#ef4444'; // red-500
  },
  'red-green': (value: number) => {
    const r = Math.round(255 * (1 - value / 100));
    const g = Math.round(255 * (value / 100));
    return `rgb(${r}, ${g}, 0)`;
  },
  'blue-yellow': (value: number) => {
    if (value >= 90) return '#3b82f6'; // blue-500
    if (value >= 80) return '#60a5fa'; // blue-400
    if (value >= 70) return '#fcd34d'; // yellow-300
    if (value >= 60) return '#fbbf24'; // yellow-400
    return '#f59e0b'; // yellow-500
  },
  grayscale: (value: number) => {
    const intensity = Math.round(255 * (value / 100));
    return `rgb(${intensity}, ${intensity}, ${intensity})`;
  },
};

// ============================================================================
// Component
// ============================================================================

export default function SLAComplianceHeatmap({
  data,
  colorScale = 'default',
  showValues = false,
  showTooltip = true,
  height = 500,
  onCellClick,
}: SLAComplianceHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<{ hour: number; day: number } | null>(null);
  const [selectedColorScale, setSelectedColorScale] = useState<ColorScale>(colorScale);

  // ============================================================================
  // Data Processing
  // ============================================================================

  const heatmapMatrix = useMemo(() => {
    // Initialize matrix with zeros
    const matrix: (SLAHeatmapData | null)[][] = Array.from({ length: 7 }, () =>
      Array(24).fill(null)
    );

    // Fill matrix with data
    data.forEach(item => {
      if (item.day >= 0 && item.day < 7 && item.hour >= 0 && item.hour < 24) {
        matrix[item.day][item.hour] = item;
      }
    });

    return matrix;
  }, [data]);

  const statistics = useMemo(() => {
    const validData = data.filter(d => d.total_tickets > 0);

    if (validData.length === 0) {
      return {
        avgCompliance: 0,
        minCompliance: 0,
        maxCompliance: 0,
        totalTickets: 0,
        totalViolated: 0,
      };
    }

    const totalTickets = validData.reduce((sum, d) => sum + d.total_tickets, 0);
    const totalViolated = validData.reduce((sum, d) => sum + d.violated_tickets, 0);

    return {
      avgCompliance:
        validData.reduce((sum, d) => sum + d.compliance_rate, 0) / validData.length,
      minCompliance: Math.min(...validData.map(d => d.compliance_rate)),
      maxCompliance: Math.max(...validData.map(d => d.compliance_rate)),
      totalTickets,
      totalViolated,
      overallCompliance: totalTickets > 0 ? ((totalTickets - totalViolated) / totalTickets) * 100 : 0,
    };
  }, [data]);

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getCellColor = (cellData: SLAHeatmapData | null): string => {
    if (!cellData || cellData.total_tickets === 0) {
      return '#f3f4f6'; // gray-100
    }

    return COLOR_SCALES[selectedColorScale](cellData.compliance_rate);
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const handleCellClick = (hour: number, day: number) => {
    onCellClick?.(hour, day);
  };

  // ============================================================================
  // Render Tooltip
  // ============================================================================

  const renderTooltip = (cellData: SLAHeatmapData, hour: number, day: number) => {
    if (!showTooltip || !hoveredCell || hoveredCell.hour !== hour || hoveredCell.day !== day) {
      return null;
    }

    return (
      <div className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm pointer-events-none"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, calc(-100% - 10px))',
          minWidth: '200px',
        }}
      >
        <div className="font-semibold text-gray-900 mb-2">
          {DAYS[day]} at {formatHour(hour)}
        </div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Compliance:</span>
            <span className="font-medium text-gray-900">
              {cellData.compliance_rate.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Tickets:</span>
            <span className="font-medium text-gray-900">{cellData.total_tickets}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Violated:</span>
            <span className="font-medium text-red-600">{cellData.violated_tickets}</span>
          </div>
          {cellData.avg_response_time !== undefined && (
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Response:</span>
              <span className="font-medium text-gray-900">
                {cellData.avg_response_time.toFixed(1)}m
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Render Legend
  // ============================================================================

  const renderLegend = () => {
    const legendValues = [0, 25, 50, 75, 100];

    return (
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Compliance Rate:</span>
        <div className="flex items-center gap-2">
          {legendValues.map((value, index) => (
            <div key={value} className="flex items-center gap-1">
              <div
                className="w-8 h-4 rounded"
                style={{ backgroundColor: COLOR_SCALES[selectedColorScale](value) }}
              />
              <span className="text-xs text-gray-600">
                {value}%{index < legendValues.length - 1 && ' -'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ============================================================================
  // Render Component
  // ============================================================================

  const cellSize = 40;
  const cellGap = 2;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">SLA Compliance Heatmap</h3>
          <p className="text-sm text-gray-500 mt-1">
            By hour of day and day of week
          </p>
        </div>

        {/* Color Scale Selector */}
        <div className="flex gap-2">
          <select
            value={selectedColorScale}
            onChange={(e) => setSelectedColorScale(e.target.value as ColorScale)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="default">Default</option>
            <option value="red-green">Red-Green</option>
            <option value="blue-yellow">Blue-Yellow</option>
            <option value="grayscale">Grayscale</option>
          </select>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Overall Compliance</p>
          <p className="text-xl font-semibold text-gray-900">
            {statistics.overallCompliance.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Average</p>
          <p className="text-xl font-semibold text-blue-600">
            {statistics.avgCompliance.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Best Hour</p>
          <p className="text-xl font-semibold text-green-600">
            {statistics.maxCompliance.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Worst Hour</p>
          <p className="text-xl font-semibold text-red-600">
            {statistics.minCompliance.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total Tickets</p>
          <p className="text-xl font-semibold text-gray-900">
            {statistics.totalTickets.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-6">{renderLegend()}</div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: `${(cellSize + cellGap) * 25}px` }}>
          {/* Hour Labels */}
          <div className="flex ml-16 mb-2">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="flex items-center justify-center text-xs text-gray-600 font-medium"
                style={{
                  width: cellSize,
                  marginRight: cellGap,
                }}
              >
                {hour === 0 || hour % 3 === 0 ? hour : ''}
              </div>
            ))}
          </div>

          {/* Heatmap Grid */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center mb-0.5">
              {/* Day Label */}
              <div className="w-14 text-sm font-medium text-gray-700 text-right pr-2">
                {day}
              </div>

              {/* Hour Cells */}
              <div className="flex">
                {HOURS.map(hour => {
                  const cellData = heatmapMatrix[dayIndex][hour];
                  const hasData = cellData && cellData.total_tickets > 0;

                  return (
                    <div
                      key={hour}
                      className="relative"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        marginRight: cellGap,
                      }}
                    >
                      <div
                        className={`w-full h-full rounded transition-all ${
                          hasData ? 'cursor-pointer hover:ring-2 hover:ring-blue-500' : ''
                        }`}
                        style={{
                          backgroundColor: getCellColor(cellData),
                        }}
                        onMouseEnter={() =>
                          hasData && setHoveredCell({ hour, day: dayIndex })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        onClick={() => hasData && handleCellClick(hour, dayIndex)}
                      >
                        {showValues && hasData && (
                          <div className="flex items-center justify-center w-full h-full text-xs font-medium text-white mix-blend-difference">
                            {Math.round(cellData.compliance_rate)}
                          </div>
                        )}
                      </div>

                      {/* Tooltip */}
                      {hasData && renderTooltip(cellData, hour, dayIndex)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Hour Labels (bottom) */}
          <div className="flex ml-16 mt-2">
            {HOURS.map(hour => (
              <div
                key={hour}
                className="flex items-center justify-center text-xs text-gray-600"
                style={{
                  width: cellSize,
                  marginRight: cellGap,
                }}
              >
                {hour === 0 || hour % 6 === 0 ? formatHour(hour) : ''}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Key Insights</h4>
        <ul className="space-y-2 text-sm text-gray-600">
          {statistics.avgCompliance >= 95 && (
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Excellent overall compliance rate of {statistics.avgCompliance.toFixed(1)}%</span>
            </li>
          )}
          {statistics.avgCompliance < 80 && (
            <li className="flex items-start gap-2">
              <span className="text-red-500 mt-0.5">!</span>
              <span>Compliance rate below target - consider reviewing SLA policies</span>
            </li>
          )}
          {statistics.maxCompliance - statistics.minCompliance > 30 && (
            <li className="flex items-start gap-2">
              <span className="text-yellow-500 mt-0.5">⚠</span>
              <span>
                High variance detected ({statistics.minCompliance.toFixed(1)}% - {statistics.maxCompliance.toFixed(1)}%) -
                investigate time-of-day staffing patterns
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">i</span>
            <span>
              {statistics.totalViolated} SLA violations out of {statistics.totalTickets} tickets analyzed
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
