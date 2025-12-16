/**
 * Drill-Down State Management
 *
 * Manages hierarchical navigation through chart data with breadcrumb trail
 * and state persistence.
 *
 * @module lib/charts/drill-down
 */

export interface DrillDownLevel {
  id: string;
  label: string;
  data: any;
  filter?: Record<string, any>;
}

export interface DrillDownState {
  levels: DrillDownLevel[];
  currentLevel: number;
}

/**
 * Create initial drill-down state
 */
export function createDrillDownState(initialData: any, initialLabel = 'Overview'): DrillDownState {
  return {
    levels: [
      {
        id: 'root',
        label: initialLabel,
        data: initialData,
      },
    ],
    currentLevel: 0,
  };
}

/**
 * Drill down to next level
 */
export function drillDown(
  state: DrillDownState,
  label: string,
  data: any,
  filter?: Record<string, any>
): DrillDownState {
  const newLevel: DrillDownLevel = {
    id: `level-${state.levels.length}`,
    label,
    data,
    filter,
  };

  return {
    levels: [...state.levels, newLevel],
    currentLevel: state.levels.length,
  };
}

/**
 * Drill up to previous level
 */
export function drillUp(state: DrillDownState): DrillDownState {
  if (state.currentLevel === 0) return state;

  return {
    ...state,
    levels: state.levels.slice(0, -1),
    currentLevel: state.currentLevel - 1,
  };
}

/**
 * Jump to specific level
 */
export function jumpToLevel(state: DrillDownState, levelIndex: number): DrillDownState {
  if (levelIndex < 0 || levelIndex >= state.levels.length) return state;

  return {
    ...state,
    levels: state.levels.slice(0, levelIndex + 1),
    currentLevel: levelIndex,
  };
}

/**
 * Reset to root level
 */
export function resetDrillDown(state: DrillDownState): DrillDownState {
  return {
    ...state,
    levels: [state.levels[0]],
    currentLevel: 0,
  };
}

/**
 * Get current level data
 */
export function getCurrentLevel(state: DrillDownState): DrillDownLevel {
  return state.levels[state.currentLevel];
}

/**
 * Check if can drill up
 */
export function canDrillUp(state: DrillDownState): boolean {
  return state.currentLevel > 0;
}

/**
 * Get breadcrumb trail
 */
export function getBreadcrumbs(state: DrillDownState): Array<{ label: string; index: number }> {
  return state.levels.map((level, index) => ({
    label: level.label,
    index,
  }));
}

/**
 * Apply filters from drill-down path
 */
export function getActiveFilters(state: DrillDownState): Record<string, any> {
  return state.levels.reduce((acc, level) => {
    if (level.filter) {
      return { ...acc, ...level.filter };
    }
    return acc;
  }, {});
}

/**
 * Hook for managing drill-down state in React components
 */
export function useDrillDown(initialData: any, initialLabel = 'Overview') {
  // This would be a React hook in actual implementation
  // For now, we'll provide the utility functions
  return {
    createDrillDownState,
    drillDown,
    drillUp,
    jumpToLevel,
    resetDrillDown,
    getCurrentLevel,
    canDrillUp,
    getBreadcrumbs,
    getActiveFilters,
  };
}
