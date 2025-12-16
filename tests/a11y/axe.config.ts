/**
 * Axe-core Accessibility Testing Configuration
 * WCAG 2.1 Level AA Compliance
 */

import type { RunOptions, Spec } from 'axe-core';

export const axeConfig: RunOptions = {
  rules: {
    // Color contrast rules (WCAG 2.1 AA)
    'color-contrast': { enabled: true },
    'color-contrast-enhanced': { enabled: false }, // AAA only

    // HTML structure
    'html-has-lang': { enabled: true },
    'html-lang-valid': { enabled: true },
    'valid-lang': { enabled: true },

    // Form labels and inputs
    'label': { enabled: true },
    'label-title-only': { enabled: true },
    'input-button-name': { enabled: true },
    'input-image-alt': { enabled: true },

    // Interactive elements
    'link-name': { enabled: true },
    'button-name': { enabled: true },
    'link-in-text-block': { enabled: true },

    // ARIA
    'aria-allowed-attr': { enabled: true },
    'aria-allowed-role': { enabled: true },
    'aria-hidden-body': { enabled: true },
    'aria-hidden-focus': { enabled: true },
    'aria-input-field-name': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-required-children': { enabled: true },
    'aria-required-parent': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },

    // Keyboard accessibility
    'tabindex': { enabled: true },
    'focus-order-semantics': { enabled: true },

    // Images
    'image-alt': { enabled: true },
    'image-redundant-alt': { enabled: true },

    // Headings
    'heading-order': { enabled: true },
    'empty-heading': { enabled: true },

    // Landmarks
    'landmark-one-main': { enabled: true },
    'landmark-unique': { enabled: true },
    'region': { enabled: true },

    // Tables
    'table-duplicate-name': { enabled: true },
    'td-headers-attr': { enabled: true },
    'th-has-data-cells': { enabled: true },

    // Lists
    'list': { enabled: true },
    'listitem': { enabled: true },

    // Forms
    'duplicate-id': { enabled: true },
    'duplicate-id-active': { enabled: true },
    'duplicate-id-aria': { enabled: true },

    // Bypass blocks
    'bypass': { enabled: true },
    'skip-link': { enabled: true },
  },
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']
  },
  reporter: 'v2'
};

/**
 * Axe configuration for WCAG 2.1 Level AAA testing
 * (More strict requirements - optional)
 */
export const axeConfigAAA: RunOptions = {
  ...axeConfig,
  rules: {
    ...axeConfig.rules,
    'color-contrast-enhanced': { enabled: true }, // AAA requirement
  },
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag2aaa', 'wcag21aaa', 'best-practice']
  }
};

/**
 * Critical violations that should fail the build
 */
export const criticalImpact = ['critical', 'serious'];

/**
 * Tags for specific compliance standards
 */
export const complianceTags = {
  wcag2a: ['wcag2a'],
  wcag2aa: ['wcag2a', 'wcag2aa'],
  wcag21a: ['wcag21a'],
  wcag21aa: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  wcag21aaa: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag2aaa', 'wcag21aaa'],
  section508: ['section508'],
  en301549: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'], // EU standard
};

/**
 * Helper to filter violations by impact level
 */
export function filterViolationsByImpact(
  violations: any[],
  impacts: string[]
): any[] {
  return violations.filter(v => impacts.includes(v.impact));
}

/**
 * Helper to format violations for reporting
 */
export function formatViolations(violations: any[]): string {
  if (violations.length === 0) {
    return 'No violations found!';
  }

  return violations
    .map(violation => {
      const { id, impact, description, help, helpUrl, nodes } = violation;
      const nodeCount = nodes.length;
      const targets = nodes.map((n: any) => n.target.join(' ')).join(', ');

      return `
[${impact.toUpperCase()}] ${id}
Description: ${description}
Help: ${help}
URL: ${helpUrl}
Affected elements (${nodeCount}): ${targets}
      `.trim();
    })
    .join('\n\n');
}
