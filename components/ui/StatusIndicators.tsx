/**
 * Status Indicators Component
 *
 * Comprehensive visual status indicators for tickets, users, system health,
 * and other entities with persona-specific styling and accessibility features.
 */

'use client';

import React, { useState, useRef } from 'react';
import { logger } from '@/lib/monitoring/logger';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PauseCircleIcon,
  InformationCircleIcon,
  SignalIcon,
  SignalSlashIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  HeartIcon,
  WifiIcon,
  UserIcon,
  Cog6ToothIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { PersonaType } from '../../../lib/design-system/tokens';

interface StatusIndicatorProps {
  status: string;
  type?: 'ticket' | 'user' | 'system' | 'sla' | 'priority' | 'connection' | 'health' | 'security';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'dot' | 'badge' | 'pill' | 'card' | 'icon';
  showLabel?: boolean;
  showTooltip?: boolean;
  animated?: boolean;
  persona?: PersonaType;
  className?: string;
  onClick?: () => void;
  tooltip?: string;
  customLabel?: string;
  metadata?: Record<string, any>;
}

interface StatusConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
  description?: string;
  priority?: number;
}

// Status configurations by type
const statusConfigs: Record<string, Record<string, StatusConfig>> = {
  ticket: {
    open: {
      label: 'Open',
      icon: InformationCircleIcon,
      color: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500'
      },
      description: 'Ticket is open and awaiting response',
      priority: 3
    },
    'in-progress': {
      label: 'In Progress',
      icon: ClockIcon,
      color: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      },
      description: 'Ticket is being actively worked on',
      priority: 4
    },
    pending: {
      label: 'Pending',
      icon: PauseCircleIcon,
      color: {
        bg: 'bg-gray-50',
        text: 'text-gray-700',
        border: 'border-gray-200',
        dot: 'bg-gray-500'
      },
      description: 'Waiting for customer response',
      priority: 2
    },
    resolved: {
      label: 'Resolved',
      icon: CheckCircleIcon,
      color: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      },
      description: 'Ticket has been resolved',
      priority: 1
    },
    closed: {
      label: 'Closed',
      icon: XCircleIcon,
      color: {
        bg: 'bg-gray-50',
        text: 'text-gray-600',
        border: 'border-gray-200',
        dot: 'bg-gray-400'
      },
      description: 'Ticket is closed',
      priority: 0
    },
    cancelled: {
      label: 'Cancelled',
      icon: XCircleIcon,
      color: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      },
      description: 'Ticket was cancelled',
      priority: 0
    }
  },

  priority: {
    low: {
      label: 'Low',
      icon: InformationCircleIcon,
      color: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      },
      priority: 1
    },
    medium: {
      label: 'Medium',
      icon: ExclamationTriangleIcon,
      color: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      },
      priority: 2
    },
    high: {
      label: 'High',
      icon: ExclamationTriangleIcon,
      color: {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200',
        dot: 'bg-orange-500'
      },
      priority: 3
    },
    critical: {
      label: 'Critical',
      icon: ExclamationTriangleIcon,
      color: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      },
      priority: 4
    }
  },

  user: {
    online: {
      label: 'Online',
      icon: UserIcon,
      color: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      },
      description: 'User is currently online'
    },
    away: {
      label: 'Away',
      icon: ClockIcon,
      color: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      },
      description: 'User is away'
    },
    busy: {
      label: 'Busy',
      icon: PauseCircleIcon,
      color: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      },
      description: 'User is busy'
    },
    offline: {
      label: 'Offline',
      icon: EyeSlashIcon,
      color: {
        bg: 'bg-gray-50',
        text: 'text-gray-600',
        border: 'border-gray-200',
        dot: 'bg-gray-400'
      },
      description: 'User is offline'
    }
  },

  system: {
    operational: {
      label: 'Operational',
      icon: CheckCircleIcon,
      color: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      },
      description: 'All systems operational'
    },
    degraded: {
      label: 'Degraded',
      icon: ExclamationTriangleIcon,
      color: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      },
      description: 'Performance issues detected'
    },
    outage: {
      label: 'Outage',
      icon: XCircleIcon,
      color: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      },
      description: 'System outage in progress'
    },
    maintenance: {
      label: 'Maintenance',
      icon: Cog6ToothIcon,
      color: {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500'
      },
      description: 'Scheduled maintenance'
    }
  },

  sla: {
    met: {
      label: 'SLA Met',
      icon: CheckCircleIcon,
      color: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      },
      description: 'SLA requirements met'
    },
    warning: {
      label: 'SLA Warning',
      icon: ExclamationTriangleIcon,
      color: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      },
      description: 'SLA deadline approaching'
    },
    breached: {
      label: 'SLA Breached',
      icon: XCircleIcon,
      color: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      },
      description: 'SLA deadline exceeded'
    }
  },

  connection: {
    connected: {
      label: 'Connected',
      icon: WifiIcon,
      color: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      }
    },
    connecting: {
      label: 'Connecting',
      icon: SignalIcon,
      color: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      }
    },
    disconnected: {
      label: 'Disconnected',
      icon: SignalSlashIcon,
      color: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      }
    }
  },

  health: {
    healthy: {
      label: 'Healthy',
      icon: HeartIcon,
      color: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      }
    },
    warning: {
      label: 'Warning',
      icon: ExclamationTriangleIcon,
      color: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      }
    },
    critical: {
      label: 'Critical',
      icon: ShieldExclamationIcon,
      color: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      }
    }
  },

  security: {
    secure: {
      label: 'Secure',
      icon: ShieldCheckIcon,
      color: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-500'
      }
    },
    warning: {
      label: 'Security Warning',
      icon: ShieldExclamationIcon,
      color: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500'
      }
    },
    threat: {
      label: 'Security Threat',
      icon: ShieldExclamationIcon,
      color: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500'
      }
    }
  }
};

export function StatusIndicator({
  status,
  type = 'ticket',
  size = 'md',
  variant = 'badge',
  showLabel = true,
  showTooltip = false,
  animated = false,
  persona = 'agent',
  className = '',
  onClick,
  tooltip,
  customLabel,
  metadata
}: StatusIndicatorProps) {
  const [showTooltipState, setShowTooltipState] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const config = statusConfigs[type]?.[status];
  if (!config) {
    logger.warn(`Unknown status "${status}" for type "${type}"`);
    return null;
  }

  const label = customLabel || config.label;
  const tooltipText = tooltip || config.description || label;

  // Size classes
  const sizeClasses = {
    xs: {
      dot: 'w-2 h-2',
      icon: 'w-3 h-3',
      text: 'text-xs',
      padding: 'px-1.5 py-0.5',
      iconPadding: 'p-1'
    },
    sm: {
      dot: 'w-2.5 h-2.5',
      icon: 'w-3.5 h-3.5',
      text: 'text-xs',
      padding: 'px-2 py-1',
      iconPadding: 'p-1.5'
    },
    md: {
      dot: 'w-3 h-3',
      icon: 'w-4 h-4',
      text: 'text-sm',
      padding: 'px-2.5 py-1.5',
      iconPadding: 'p-2'
    },
    lg: {
      dot: 'w-4 h-4',
      icon: 'w-5 h-5',
      text: 'text-base',
      padding: 'px-3 py-2',
      iconPadding: 'p-2.5'
    },
    xl: {
      dot: 'w-5 h-5',
      icon: 'w-6 h-6',
      text: 'text-lg',
      padding: 'px-4 py-3',
      iconPadding: 'p-3'
    }
  };

  const sizes = sizeClasses[size];

  // Animation classes
  const animationClasses = animated ? {
    pulse: 'animate-pulse',
    bounce: 'animate-bounce-soft',
    spin: 'animate-spin'
  } : {};

  // Persona-specific adjustments
  const personaClasses = {
    enduser: 'transition-smooth',
    agent: 'transition-subtle',
    manager: 'transition-smooth'
  };

  // Render variants
  const renderDot = () => (
    <div
      className={`inline-flex items-center gap-2 ${personaClasses[persona]} ${className}`}
      title={showTooltip ? tooltipText : undefined}
    >
      <div
        className={`${sizes.dot} ${config.color.dot} rounded-full ${
          animated ? animationClasses.pulse : ''
        }`}
      />
      {showLabel && (
        <span className={`${sizes.text} ${config.color.text} font-medium`}>
          {label}
        </span>
      )}
    </div>
  );

  const renderBadge = () => (
    <span
      className={`inline-flex items-center gap-1.5 ${sizes.padding} rounded-full border font-medium ${
        config.color.bg
      } ${config.color.text} ${config.color.border} ${personaClasses[persona]} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${className}`}
      onClick={onClick}
      title={showTooltip ? tooltipText : undefined}
    >
      <div
        className={`${sizes.dot} ${config.color.dot} rounded-full ${
          animated ? animationClasses.pulse : ''
        }`}
      />
      {showLabel && <span className={sizes.text}>{label}</span>}
    </span>
  );

  const renderPill = () => (
    <span
      className={`inline-flex items-center gap-1.5 ${sizes.padding} rounded-full font-medium ${
        config.color.bg
      } ${config.color.text} ${personaClasses[persona]} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${className}`}
      onClick={onClick}
      title={showTooltip ? tooltipText : undefined}
    >
      <config.icon className={`${sizes.icon} ${animated ? animationClasses.spin : ''}`} />
      {showLabel && <span className={sizes.text}>{label}</span>}
    </span>
  );

  const renderIcon = () => (
    <div
      className={`inline-flex items-center justify-center ${sizes.iconPadding} rounded-lg ${
        config.color.bg
      } ${config.color.border} border ${personaClasses[persona]} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${className}`}
      onClick={onClick}
      title={showTooltip ? tooltipText : undefined}
    >
      <config.icon
        className={`${sizes.icon} ${config.color.text} ${
          animated ? animationClasses.spin : ''
        }`}
      />
    </div>
  );

  const renderCard = () => (
    <div
      className={`inline-flex items-center gap-3 p-3 rounded-lg border ${config.color.bg} ${
        config.color.border
      } ${personaClasses[persona]} ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${className}`}
      onClick={onClick}
    >
      <div
        className={`flex items-center justify-center w-8 h-8 rounded-lg bg-white/50 ${config.color.border} border`}
      >
        <config.icon
          className={`w-4 h-4 ${config.color.text} ${
            animated ? animationClasses.spin : ''
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        {showLabel && (
          <div className={`font-semibold ${config.color.text}`}>{label}</div>
        )}
        {config.description && (
          <div className={`text-sm ${config.color.text} opacity-75`}>
            {config.description}
          </div>
        )}
        {metadata && (
          <div className="text-xs text-gray-500 mt-1">
            {Object.entries(metadata).map(([key, value]) => (
              <span key={key} className="mr-2">
                {key}: {String(value)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render the appropriate variant
  const renderVariant = () => {
    switch (variant) {
      case 'dot':
        return renderDot();
      case 'badge':
        return renderBadge();
      case 'pill':
        return renderPill();
      case 'icon':
        return renderIcon();
      case 'card':
        return renderCard();
      default:
        return renderBadge();
    }
  };

  const element = renderVariant();

  // Wrap with tooltip if needed
  if (showTooltip && tooltipText) {
    return (
      <div
        className="relative inline-block"
        onMouseEnter={() => setShowTooltipState(true)}
        onMouseLeave={() => setShowTooltipState(false)}
      >
        {element}
        {showTooltipState && (
          <div
            ref={tooltipRef}
            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg z-50 whitespace-nowrap"
          >
            {tooltipText}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>
    );
  }

  return element;
}

// Status list component for showing multiple statuses
interface StatusListProps {
  statuses: Array<{
    id: string;
    status: string;
    type?: string;
    label?: string;
    metadata?: Record<string, any>;
  }>;
  variant?: StatusIndicatorProps['variant'];
  size?: StatusIndicatorProps['size'];
  persona?: PersonaType;
  className?: string;
  onStatusClick?: (id: string) => void;
}

export function StatusList({
  statuses,
  variant = 'badge',
  size = 'md',
  persona = 'agent',
  className = '',
  onStatusClick
}: StatusListProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {statuses.map((statusItem) => (
        <StatusIndicator
          key={statusItem.id}
          status={statusItem.status}
          type={statusItem.type as any}
          variant={variant}
          size={size}
          persona={persona}
          customLabel={statusItem.label}
          metadata={statusItem.metadata}
          onClick={onStatusClick ? () => onStatusClick(statusItem.id) : undefined}
          showTooltip={true}
        />
      ))}
    </div>
  );
}

// Status counter component
interface StatusCounterProps {
  counts: Record<string, number>;
  type?: string;
  persona?: PersonaType;
  className?: string;
  onStatusClick?: (status: string) => void;
}

export function StatusCounter({
  counts,
  type = 'ticket',
  className = '',
  onStatusClick
}: StatusCounterProps) {
  const statusTypes = statusConfigs[type];
  if (!statusTypes) return null;

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {Object.entries(counts).map(([status, count]) => {
        const config = statusTypes[status];
        if (!config || count === 0) return null;

        return (
          <button
            key={status}
            onClick={onStatusClick ? () => onStatusClick(status) : undefined}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              config.color.bg
            } ${config.color.border} hover:shadow-md ${
              onStatusClick ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <div className={`w-2 h-2 ${config.color.dot} rounded-full`} />
            <span className={`text-sm font-medium ${config.color.text}`}>
              {config.label}
            </span>
            <span className={`text-lg font-bold ${config.color.text}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// System health dashboard component
export function SystemHealthDashboard({ persona = 'manager', className = '' }: { persona?: PersonaType; className?: string }) {
  const healthMetrics = [
    { id: 'api', label: 'API Server', status: 'operational', type: 'system' },
    { id: 'database', label: 'Database', status: 'operational', type: 'system' },
    { id: 'email', label: 'Email Service', status: 'degraded', type: 'system' },
    { id: 'storage', label: 'File Storage', status: 'operational', type: 'system' },
    { id: 'security', label: 'Security', status: 'secure', type: 'security' },
    { id: 'network', label: 'Network', status: 'connected', type: 'connection' }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900">System Health</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {healthMetrics.map((metric) => (
          <StatusIndicator
            key={metric.id}
            status={metric.status}
            type={metric.type as any}
            variant="card"
            size={persona === 'manager' ? 'lg' : 'md'}
            persona={persona}
            customLabel={metric.label}
            showTooltip={true}
            animated={metric.status === 'degraded'}
          />
        ))}
      </div>
    </div>
  );
}

export default StatusIndicator;