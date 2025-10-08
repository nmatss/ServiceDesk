/**
 * Adaptive Layout Component
 *
 * Intelligent layout that automatically adapts based on:
 * - User role and permissions
 * - Screen size and device capabilities
 * - Context and current route
 * - User preferences and behavior patterns
 */

'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { logger } from '@/lib/monitoring/logger';
import {
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ComputerDesktopIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  Squares2X2Icon,
  ListBulletIcon,
  TableCellsIcon
} from '@heroicons/react/24/outline';
import { PersonaType } from '../../../lib/design-system/tokens';
import { getPersonaVariants, getResponsiveVariant } from '../../../lib/design-system/persona-variants';

interface LayoutConfig {
  density: 'compact' | 'comfortable' | 'spacious';
  viewMode: 'grid' | 'list' | 'table' | 'cards';
  sidebarPosition: 'left' | 'right' | 'hidden';
  headerStyle: 'minimal' | 'standard' | 'enhanced';
  navigation: 'sidebar' | 'top' | 'hybrid';
  contentWidth: 'narrow' | 'medium' | 'wide' | 'full';
  showSecondaryNav: boolean;
  showQuickActions: boolean;
  panelLayout: 'single' | 'dual' | 'multi';
}

interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop';
  orientation: 'portrait' | 'landscape';
  width: number;
  height: number;
  touchCapable: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

interface AdaptiveLayoutProps {
  children: React.ReactNode;
  persona: PersonaType;
  route?: string;
  userPreferences?: Partial<LayoutConfig>;
  className?: string;
  allowCustomization?: boolean;
}

export function AdaptiveLayout({
  children,
  persona,
  route,
  userPreferences = {},
  className = '',
  allowCustomization = true
}: AdaptiveLayoutProps) {
  const pathname = usePathname();
  const currentRoute = route || pathname;

  // Device and environment detection
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: 'desktop',
    orientation: 'landscape',
    width: 1920,
    height: 1080,
    touchCapable: false,
    reducedMotion: false,
    highContrast: false
  });

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [savedLayouts, setSavedLayouts] = useState<Record<string, LayoutConfig>>({});

  // Detect device capabilities and preferences
  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      const deviceType =
        width < 768 ? 'mobile' :
        width < 1024 ? 'tablet' :
        'desktop';

      const orientation = width > height ? 'landscape' : 'portrait';

      setDeviceInfo({
        type: deviceType,
        orientation,
        width,
        height,
        touchCapable: 'ontouchstart' in window,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        highContrast: window.matchMedia('(prefers-contrast: high)').matches
      });
    };

    updateDeviceInfo();
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);

    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, []);

  // Generate adaptive layout configuration
  const layoutConfig = useMemo((): LayoutConfig => {
    const baseConfig = getBaseLayoutConfig(persona, currentRoute);
    const deviceAdaptations = getDeviceAdaptations(deviceInfo, persona);
    const routeAdaptations = getRouteAdaptations(currentRoute, persona);

    return {
      ...baseConfig,
      ...deviceAdaptations,
      ...routeAdaptations,
      ...userPreferences
    };
  }, [persona, currentRoute, deviceInfo, userPreferences]);

  // Get persona-specific responsive variants
  const responsiveVariant = getResponsiveVariant(persona, 'card');
  const currentVariant = responsiveVariant[deviceInfo.type];

  // Layout state management
  const [currentLayout, setCurrentLayout] = useState<LayoutConfig>(layoutConfig);

  // Update layout when config changes
  useEffect(() => {
    setCurrentLayout(layoutConfig);
  }, [layoutConfig]);

  // Save layout preferences
  const saveLayoutPreference = (config: LayoutConfig) => {
    const key = `${persona}-${currentRoute}`;
    setSavedLayouts(prev => ({
      ...prev,
      [key]: config
    }));

    // Persist to localStorage
    try {
      localStorage.setItem('layout-preferences', JSON.stringify({
        ...savedLayouts,
        [key]: config
      }));
    } catch (error) {
      logger.warn('Failed to save layout preferences', error);
    }
  };

  // Load saved preferences
  useEffect(() => {
    try {
      const saved = localStorage.getItem('layout-preferences');
      if (saved) {
        setSavedLayouts(JSON.parse(saved));
      }
    } catch (error) {
      logger.warn('Failed to load layout preferences', error);
    }
  }, []);

  // Apply saved layout for current context
  useEffect(() => {
    const key = `${persona}-${currentRoute}`;
    const savedLayout = savedLayouts[key];
    if (savedLayout) {
      setCurrentLayout(prev => ({ ...prev, ...savedLayout }));
    }
  }, [persona, currentRoute, savedLayouts]);

  // Generate CSS classes based on current layout
  const getLayoutClasses = () => {
    const classes = [];

    // Density classes
    classes.push(`density-${currentLayout.density}`);

    // Content width
    switch (currentLayout.contentWidth) {
      case 'narrow':
        classes.push('max-w-4xl mx-auto');
        break;
      case 'medium':
        classes.push('max-w-6xl mx-auto');
        break;
      case 'wide':
        classes.push('max-w-7xl mx-auto');
        break;
      case 'full':
        classes.push('max-w-full');
        break;
    }

    // Panel layout
    if (currentLayout.panelLayout === 'dual') {
      classes.push('grid grid-cols-1 lg:grid-cols-3 gap-6');
    } else if (currentLayout.panelLayout === 'multi') {
      classes.push('grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4');
    }

    // Persona-specific classes
    classes.push(`persona-${persona}`);

    // Device-specific classes
    classes.push(`device-${deviceInfo.type}`);

    // Accessibility classes
    if (deviceInfo.reducedMotion) {
      classes.push('motion-reduced');
    }
    if (deviceInfo.highContrast) {
      classes.push('high-contrast');
    }

    return classes.join(' ');
  };

  // Render layout customization panel
  const renderCustomizationPanel = () => {
    if (!isCustomizing) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-4">
        <div className="w-80 bg-white rounded-lg shadow-2xl border border-gray-200 p-6 max-h-[calc(100vh-5rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Customize Layout
            </h3>
            <button
              onClick={() => setIsCustomizing(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            {/* Density */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Density
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
                  <button
                    key={density}
                    onClick={() => setCurrentLayout(prev => ({ ...prev, density }))}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                      currentLayout.density === density
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {density}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                View Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'grid', icon: Squares2X2Icon, label: 'Grid' },
                  { key: 'list', icon: ListBulletIcon, label: 'List' },
                  { key: 'table', icon: TableCellsIcon, label: 'Table' },
                  { key: 'cards', icon: EyeIcon, label: 'Cards' }
                ] as const).map(({ key, icon: Icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setCurrentLayout(prev => ({ ...prev, viewMode: key }))}
                    className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg border transition-colors ${
                      currentLayout.viewMode === key
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content Width */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content Width
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['narrow', 'medium', 'wide', 'full'] as const).map((width) => (
                  <button
                    key={width}
                    onClick={() => setCurrentLayout(prev => ({ ...prev, contentWidth: width }))}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                      currentLayout.contentWidth === width
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {width}
                  </button>
                ))}
              </div>
            </div>

            {/* Panel Layout */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Panel Layout
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['single', 'dual', 'multi'] as const).map((layout) => (
                  <button
                    key={layout}
                    onClick={() => setCurrentLayout(prev => ({ ...prev, panelLayout: layout }))}
                    className={`px-3 py-2 text-xs rounded-lg border transition-colors ${
                      currentLayout.panelLayout === layout
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {layout}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Secondary Navigation
                </span>
                <input
                  type="checkbox"
                  checked={currentLayout.showSecondaryNav}
                  onChange={(e) => setCurrentLayout(prev => ({
                    ...prev,
                    showSecondaryNav: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>

              <label className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Quick Actions
                </span>
                <input
                  type="checkbox"
                  checked={currentLayout.showQuickActions}
                  onChange={(e) => setCurrentLayout(prev => ({
                    ...prev,
                    showQuickActions: e.target.checked
                  }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <button
                onClick={() => saveLayoutPreference(currentLayout)}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Layout
              </button>
              <button
                onClick={() => setCurrentLayout(layoutConfig)}
                className="px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`adaptive-layout ${getLayoutClasses()} ${className}`}>
      {/* Layout customization trigger */}
      {allowCustomization && (
        <button
          onClick={() => setIsCustomizing(true)}
          className="fixed bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-40"
          title="Customize Layout"
        >
          <AdjustmentsHorizontalIcon className="w-5 h-5" />
        </button>
      )}

      {/* Device info indicator */}
      <div className="fixed bottom-4 left-4 flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-md border border-gray-200 text-xs text-gray-600">
        {deviceInfo.type === 'mobile' && <DevicePhoneMobileIcon className="w-4 h-4" />}
        {deviceInfo.type === 'tablet' && <DeviceTabletIcon className="w-4 h-4" />}
        {deviceInfo.type === 'desktop' && <ComputerDesktopIcon className="w-4 h-4" />}
        <span className="capitalize">{deviceInfo.type}</span>
        <span>•</span>
        <span className="capitalize">{currentLayout.density}</span>
      </div>

      {/* Main content */}
      <div className="adaptive-content">
        {children}
      </div>

      {/* Customization panel */}
      {renderCustomizationPanel()}
    </div>
  );
}

// Helper functions for layout adaptation
function getBaseLayoutConfig(persona: PersonaType, route: string): LayoutConfig {
  const baseConfigs: Record<PersonaType, LayoutConfig> = {
    enduser: {
      density: 'comfortable',
      viewMode: 'cards',
      sidebarPosition: 'left',
      headerStyle: 'enhanced',
      navigation: 'sidebar',
      contentWidth: 'medium',
      showSecondaryNav: false,
      showQuickActions: true,
      panelLayout: 'single'
    },
    agent: {
      density: 'compact',
      viewMode: 'table',
      sidebarPosition: 'left',
      headerStyle: 'standard',
      navigation: 'hybrid',
      contentWidth: 'wide',
      showSecondaryNav: true,
      showQuickActions: true,
      panelLayout: 'dual'
    },
    manager: {
      density: 'comfortable',
      viewMode: 'grid',
      sidebarPosition: 'left',
      headerStyle: 'enhanced',
      navigation: 'sidebar',
      contentWidth: 'full',
      showSecondaryNav: true,
      showQuickActions: true,
      panelLayout: 'multi'
    }
  };

  return baseConfigs[persona];
}

function getDeviceAdaptations(deviceInfo: DeviceInfo, persona: PersonaType): Partial<LayoutConfig> {
  const adaptations: Partial<LayoutConfig> = {};

  // Mobile adaptations
  if (deviceInfo.type === 'mobile') {
    adaptations.navigation = 'top';
    adaptations.sidebarPosition = 'hidden';
    adaptations.contentWidth = 'full';
    adaptations.panelLayout = 'single';
    adaptations.showSecondaryNav = false;

    if (persona === 'agent') {
      adaptations.density = 'comfortable';
      adaptations.viewMode = 'list';
    }
  }

  // Tablet adaptations
  if (deviceInfo.type === 'tablet') {
    if (deviceInfo.orientation === 'portrait') {
      adaptations.panelLayout = 'single';
      adaptations.contentWidth = 'medium';
    }

    if (persona === 'manager') {
      adaptations.panelLayout = 'dual';
    }
  }

  // Touch adaptations
  if (deviceInfo.touchCapable) {
    adaptations.density = persona === 'agent' ? 'comfortable' : 'spacious';
  }

  // Accessibility adaptations
  if (deviceInfo.reducedMotion) {
    // Reduce animations, handled by CSS
  }

  if (deviceInfo.highContrast) {
    // Enhance contrast, handled by CSS
  }

  return adaptations;
}

function getRouteAdaptations(route: string, persona: PersonaType): Partial<LayoutConfig> {
  const adaptations: Partial<LayoutConfig> = {};

  // Dashboard routes
  if (route.includes('dashboard')) {
    if (persona === 'manager') {
      adaptations.panelLayout = 'multi';
      adaptations.viewMode = 'grid';
    }
  }

  // Ticket routes
  if (route.includes('tickets')) {
    if (persona === 'agent') {
      adaptations.viewMode = 'table';
      adaptations.panelLayout = 'dual';
      adaptations.showQuickActions = true;
    }
  }

  // User management routes
  if (route.includes('users')) {
    adaptations.viewMode = 'table';
    adaptations.showQuickActions = true;
  }

  // Analytics routes
  if (route.includes('analytics') || route.includes('reports')) {
    adaptations.contentWidth = 'full';
    adaptations.panelLayout = 'multi';
    adaptations.viewMode = 'grid';
  }

  // Settings routes
  if (route.includes('settings') || route.includes('admin')) {
    adaptations.panelLayout = 'dual';
    adaptations.contentWidth = 'wide';
  }

  return adaptations;
}

export default AdaptiveLayout;