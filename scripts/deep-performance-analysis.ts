#!/usr/bin/env npx tsx
/**
 * Deep Performance Analysis
 * Análise profunda de performance, acessibilidade e SEO
 */

import { chromium } from '@playwright/test';

interface DeepAnalysisResult {
  pageName: string;
  performance: {
    bundleSize: number;
    unusedCSS: number;
    unusedJS: number;
    imageCount: number;
    unoptimizedImages: number;
    resourceCount: number;
    cacheableResources: number;
  };
  accessibility: {
    missingAltText: number;
    colorContrastIssues: number;
    ariaIssues: number;
    formLabelIssues: number;
    headingStructure: string[];
  };
  seo: {
    hasMetaDescription: boolean;
    metaDescriptionLength: number;
    hasH1: boolean;
    h1Count: number;
    hasSitemap: boolean;
    hasRobots: boolean;
    structuredData: boolean;
  };
}

async function analyzePageDeep(url: string, pageName: string): Promise<DeepAnalysisResult> {
  console.log(`\n🔬 Deep Analysis: ${pageName}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'networkidle' });

  // Análise de Performance
  const perfAnalysis = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    return {
      bundleSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
      resourceCount: resources.length,
      imageCount: resources.filter(r => r.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)).length,
    };
  });

  // Análise de Acessibilidade
  const a11yAnalysis = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    const missingAltText = images.filter(img => !img.hasAttribute('alt') || img.alt.trim() === '').length;

    const forms = Array.from(document.querySelectorAll('input, textarea, select'));
    const formLabelIssues = forms.filter(input => {
      const id = input.id;
      if (!id) return true;
      const label = document.querySelector(`label[for="${id}"]`);
      return !label && !input.hasAttribute('aria-label') && !input.hasAttribute('aria-labelledby');
    }).length;

    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const headingStructure = headings.map(h => h.tagName);

    const ariaElements = Array.from(document.querySelectorAll('[role], [aria-label], [aria-labelledby], [aria-describedby]'));
    const ariaIssues = ariaElements.filter(el => {
      const role = el.getAttribute('role');
      if (role === 'button' && el.tagName !== 'BUTTON') {
        return !el.hasAttribute('tabindex');
      }
      return false;
    }).length;

    return {
      missingAltText,
      formLabelIssues,
      headingStructure,
      ariaIssues,
      colorContrastIssues: 0, // Requires complex color analysis
    };
  });

  // Análise de SEO
  const seoAnalysis = await page.evaluate(() => {
    const metaDescription = document.querySelector('meta[name="description"]');
    const hasMetaDescription = !!metaDescription;
    const metaDescriptionLength = metaDescription?.getAttribute('content')?.length || 0;

    const h1Elements = document.querySelectorAll('h1');
    const hasH1 = h1Elements.length > 0;
    const h1Count = h1Elements.length;

    return {
      hasMetaDescription,
      metaDescriptionLength,
      hasH1,
      h1Count,
      hasSitemap: false, // Requires checking /sitemap.xml
      hasRobots: false, // Requires checking /robots.txt
      structuredData: !!document.querySelector('script[type="application/ld+json"]'),
    };
  });

  await browser.close();

  return {
    pageName,
    performance: {
      bundleSize: perfAnalysis.bundleSize,
      unusedCSS: 0,
      unusedJS: 0,
      imageCount: perfAnalysis.imageCount,
      unoptimizedImages: 0,
      resourceCount: perfAnalysis.resourceCount,
      cacheableResources: 0,
    },
    accessibility: a11yAnalysis,
    seo: seoAnalysis,
  };
}

async function runDeepAnalysis() {
  console.log('🔬 DEEP PERFORMANCE ANALYSIS\n');
  console.log('='.repeat(80));

  const pages = [
    { url: 'http://localhost:3000/', name: 'Home' },
    { url: 'http://localhost:3000/portal', name: 'Portal' },
    { url: 'http://localhost:3000/portal/knowledge', name: 'Knowledge Base' },
  ];

  const results: DeepAnalysisResult[] = [];

  for (const page of pages) {
    try {
      const result = await analyzePageDeep(page.url, page.name);
      results.push(result);

      console.log(`\n✅ ${result.pageName}:`);
      console.log(`   Bundle Size: ${(result.performance.bundleSize / 1024).toFixed(2)} KB`);
      console.log(`   Resources: ${result.performance.resourceCount}`);
      console.log(`   Images: ${result.performance.imageCount}`);
      console.log(`   Missing Alt Text: ${result.accessibility.missingAltText}`);
      console.log(`   Form Label Issues: ${result.accessibility.formLabelIssues}`);
      console.log(`   Has Meta Description: ${result.seo.hasMetaDescription ? '✅' : '❌'}`);
      console.log(`   Meta Description Length: ${result.seo.metaDescriptionLength} chars`);
      console.log(`   H1 Count: ${result.seo.h1Count}`);
    } catch (error) {
      console.error(`❌ Error analyzing ${page.name}:`, error);
    }
  }

  // Consolidar issues
  console.log('\n' + '='.repeat(80));
  console.log('🎯 CONSOLIDATED ISSUES\n');

  const totalMissingAlt = results.reduce((sum, r) => sum + r.accessibility.missingAltText, 0);
  const totalFormIssues = results.reduce((sum, r) => sum + r.accessibility.formLabelIssues, 0);
  const pagesWithoutMetaDesc = results.filter(r => !r.seo.hasMetaDescription).length;
  const pagesWithMultipleH1 = results.filter(r => r.seo.h1Count > 1).length;

  console.log('### Accessibility Issues:');
  console.log(`- ${totalMissingAlt} images missing alt text`);
  console.log(`- ${totalFormIssues} form inputs missing labels`);

  console.log('\n### SEO Issues:');
  console.log(`- ${pagesWithoutMetaDesc}/${results.length} pages missing meta description`);
  console.log(`- ${pagesWithMultipleH1} pages with multiple H1 tags`);

  console.log('\n' + '='.repeat(80));
}

runDeepAnalysis().catch(console.error);
