#!/usr/bin/env ts-node

/**
 * Accessibility Report Generator
 * Generates comprehensive HTML reports from axe-core test results
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHtmlReport } from 'axe-html-reporter';

interface AxeViolation {
  id: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

interface AxeResults {
  violations: AxeViolation[];
  passes: any[];
  incomplete: any[];
  inapplicable: any[];
  timestamp: string;
  url: string;
}

interface ComplianceReport {
  totalTests: number;
  totalViolations: number;
  criticalViolations: number;
  seriousViolations: number;
  moderateViolations: number;
  minorViolations: number;
  wcagACompliance: number;
  wcagAACompliance: number;
  wcagAAACompliance: number;
  section508Compliance: number;
  timestamp: string;
}

const REPORTS_DIR = path.join(process.cwd(), 'reports', 'accessibility');
const TEST_RESULTS_DIR = path.join(process.cwd(), 'test-results');

// Ensure reports directory exists
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

/**
 * Generate HTML report from axe results
 */
function generateHtmlReport(results: AxeResults, outputPath: string): void {
  const reportHTML = createHtmlReport({
    results: {
      violations: results.violations,
      passes: results.passes,
      incomplete: results.incomplete,
      inapplicable: results.inapplicable,
      url: results.url,
      timestamp: results.timestamp,
      toolOptions: {},
      testEngine: { name: 'axe-core', version: '4.10.2' },
      testRunner: { name: 'playwright' },
      testEnvironment: {}
    },
    options: {
      projectKey: 'ServiceDesk',
      outputDir: REPORTS_DIR,
      reportFileName: path.basename(outputPath)
    }
  });

  fs.writeFileSync(outputPath, reportHTML);
  console.log(`✅ HTML report generated: ${outputPath}`);
}

/**
 * Calculate compliance score
 */
function calculateCompliance(results: AxeResults[]): ComplianceReport {
  let totalViolations = 0;
  let criticalViolations = 0;
  let seriousViolations = 0;
  let moderateViolations = 0;
  let minorViolations = 0;

  const wcagATags = new Set<string>();
  const wcagAATags = new Set<string>();
  const wcagAAATags = new Set<string>();
  const section508Tags = new Set<string>();

  results.forEach(result => {
    result.violations.forEach(violation => {
      totalViolations++;

      // Count by impact
      switch (violation.impact) {
        case 'critical':
          criticalViolations++;
          break;
        case 'serious':
          seriousViolations++;
          break;
        case 'moderate':
          moderateViolations++;
          break;
        case 'minor':
          minorViolations++;
          break;
      }

      // Track WCAG violations
      violation.tags.forEach(tag => {
        if (tag.includes('wcag2a')) wcagATags.add(violation.id);
        if (tag.includes('wcag2aa')) wcagAATags.add(violation.id);
        if (tag.includes('wcag2aaa')) wcagAAATags.add(violation.id);
        if (tag.includes('section508')) section508Tags.add(violation.id);
      });
    });
  });

  const totalTests = results.length;
  const passedTests = results.filter(r => r.violations.length === 0).length;

  return {
    totalTests,
    totalViolations,
    criticalViolations,
    seriousViolations,
    moderateViolations,
    minorViolations,
    wcagACompliance: totalTests > 0 ? ((totalTests - wcagATags.size) / totalTests) * 100 : 100,
    wcagAACompliance: totalTests > 0 ? ((totalTests - wcagAATags.size) / totalTests) * 100 : 100,
    wcagAAACompliance: totalTests > 0 ? ((totalTests - wcagAAATags.size) / totalTests) * 100 : 100,
    section508Compliance: totalTests > 0 ? ((totalTests - section508Tags.size) / totalTests) * 100 : 100,
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate summary report
 */
function generateSummaryReport(report: ComplianceReport): void {
  const summaryPath = path.join(REPORTS_DIR, 'summary.json');

  fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));
  console.log(`✅ Summary report generated: ${summaryPath}`);

  // Generate Markdown summary
  const markdownSummary = `
# Accessibility Compliance Report

**Generated:** ${new Date(report.timestamp).toLocaleString()}

## Compliance Scores

| Standard | Compliance | Status |
|----------|-----------|--------|
| WCAG 2.1 Level A | ${report.wcagACompliance.toFixed(1)}% | ${report.wcagACompliance >= 100 ? '✅ Pass' : '❌ Fail'} |
| WCAG 2.1 Level AA | ${report.wcagAACompliance.toFixed(1)}% | ${report.wcagAACompliance >= 100 ? '✅ Pass' : '❌ Fail'} |
| WCAG 2.1 Level AAA | ${report.wcagAAACompliance.toFixed(1)}% | ${report.wcagAAACompliance >= 100 ? '✅ Pass' : '⭐ Aspirational'} |
| Section 508 | ${report.section508Compliance.toFixed(1)}% | ${report.section508Compliance >= 100 ? '✅ Pass' : '❌ Fail'} |

## Violations Summary

| Impact Level | Count |
|-------------|-------|
| Critical | ${report.criticalViolations} |
| Serious | ${report.seriousViolations} |
| Moderate | ${report.moderateViolations} |
| Minor | ${report.minorViolations} |
| **Total** | **${report.totalViolations}** |

## Test Statistics

- **Total Tests**: ${report.totalTests}
- **Total Violations**: ${report.totalViolations}
- **Pass Rate**: ${report.totalViolations === 0 ? '100%' : ((1 - (report.totalViolations / report.totalTests)) * 100).toFixed(1) + '%'}

## Compliance Status

${report.wcagAACompliance >= 100 ? '✅ **WCAG 2.1 Level AA Compliant**' : '❌ **Not WCAG 2.1 Level AA Compliant**'}

${report.totalViolations === 0
  ? '🎉 **No accessibility violations detected!**'
  : `⚠️ **${report.totalViolations} accessibility issue${report.totalViolations > 1 ? 's' : ''} found**`}

### Critical Actions Required

${report.criticalViolations > 0
  ? `🚨 **${report.criticalViolations} critical violation${report.criticalViolations > 1 ? 's' : ''} must be fixed immediately**`
  : '✅ No critical violations'}

${report.seriousViolations > 0
  ? `⚠️ **${report.seriousViolations} serious violation${report.seriousViolations > 1 ? 's' : ''} should be fixed soon**`
  : '✅ No serious violations'}

## Next Steps

${report.totalViolations > 0 ? `
1. Review detailed violation reports in \`reports/accessibility/\`
2. Fix critical and serious violations first
3. Address moderate and minor violations
4. Re-run accessibility tests
5. Perform manual screen reader testing
` : `
1. Continue monitoring for accessibility regressions
2. Perform periodic manual testing with screen readers
3. Consider achieving WCAG 2.1 Level AAA for enhanced accessibility
`}

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [WebAIM Resources](https://webaim.org/)

---
*Report generated by axe-core via Playwright*
`;

  const markdownPath = path.join(REPORTS_DIR, 'REPORT.md');
  fs.writeFileSync(markdownPath, markdownSummary.trim());
  console.log(`✅ Markdown summary generated: ${markdownPath}`);

  // Print to console
  console.log('\n' + '='.repeat(60));
  console.log(markdownSummary);
  console.log('='.repeat(60) + '\n');
}

/**
 * Generate badge for README
 */
function generateBadge(report: ComplianceReport): void {
  const compliance = report.wcagAACompliance;
  let color = 'red';
  let label = 'failing';

  if (compliance >= 100) {
    color = 'brightgreen';
    label = 'passing';
  } else if (compliance >= 90) {
    color = 'yellow';
    label = 'partial';
  }

  const badgeMarkdown = `![Accessibility](https://img.shields.io/badge/WCAG%202.1%20AA-${label}-${color})`;

  const badgePath = path.join(REPORTS_DIR, 'badge.md');
  fs.writeFileSync(badgePath, badgeMarkdown);

  console.log(`✅ Badge generated: ${badgeMarkdown}`);
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Generating Accessibility Reports...\n');

  // Mock results for demonstration (replace with actual test results)
  const mockResults: AxeResults[] = [
    {
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: [],
      timestamp: new Date().toISOString(),
      url: 'http://localhost:3000/auth/login'
    }
  ];

  // Generate HTML report for each result
  mockResults.forEach((result, index) => {
    const outputPath = path.join(REPORTS_DIR, `report-${index + 1}.html`);
    generateHtmlReport(result, outputPath);
  });

  // Calculate and generate compliance report
  const complianceReport = calculateCompliance(mockResults);
  generateSummaryReport(complianceReport);
  generateBadge(complianceReport);

  console.log('\n✨ All reports generated successfully!\n');
  console.log(`📁 Reports location: ${REPORTS_DIR}`);

  // Exit with error code if violations found
  if (complianceReport.criticalViolations > 0 || complianceReport.seriousViolations > 0) {
    console.log('\n❌ Build should fail due to critical/serious violations\n');
    process.exit(1);
  } else {
    console.log('\n✅ All accessibility checks passed!\n');
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  generateHtmlReport,
  calculateCompliance,
  generateSummaryReport,
  generateBadge
};
