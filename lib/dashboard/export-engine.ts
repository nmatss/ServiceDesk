'use client';

/**
 * Dashboard Export Engine
 *
 * Provides export functionality for dashboards to PDF and Excel formats.
 * This file must be client-only as it uses browser-specific libraries
 * (jsPDF, html2canvas, XLSX) that reference DOM APIs like 'document' and 'self'.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import logger from '../monitoring/structured-logger';

export interface ExportOptions {
  title: string;
  subtitle?: string;
  widgets?: any[];
  metrics?: any;
  format?: 'pdf' | 'excel';
  includeCharts?: boolean;
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'letter';
  author?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// PDF Export
// ============================================================================

export async function exportToPDF(options: ExportOptions): Promise<void> {
  const {
    title,
    subtitle,
    widgets = [],
    metrics,
    orientation = 'landscape',
    pageSize = 'a4',
    author = 'ServiceDesk',
    includeCharts = true
  } = options;

  try {
    // Initialize PDF document
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: pageSize
    });

    // Set metadata
    pdf.setProperties({
      title: title,
      subject: subtitle || 'Dashboard Report',
      author: author,
      creator: 'ServiceDesk Export Engine'
    });

    let yPosition = 20;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;

    // Add header
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    if (subtitle) {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(subtitle, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;
    }

    // Add generation timestamp
    pdf.setFontSize(10);
    pdf.setTextColor(100);
    pdf.text(
      `Generated on: ${new Date().toLocaleString()}`,
      pageWidth / 2,
      yPosition,
      { align: 'center' }
    );
    yPosition += 15;
    pdf.setTextColor(0);

    // Add summary metrics if available
    if (metrics?.kpiSummary) {
      yPosition = await addKPISummaryToPDF(pdf, metrics.kpiSummary, yPosition, margin, pageWidth);
    }

    // Add charts if requested
    if (includeCharts) {
      for (const widget of widgets) {
        // Check if we need a new page
        if (yPosition > pageHeight - 60) {
          pdf.addPage();
          yPosition = 20;
        }

        yPosition = await addWidgetToPDF(pdf, widget, yPosition, margin, pageWidth, pageHeight);
      }
    }

    // Add footer to all pages
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      pdf.text(
        'ServiceDesk - Dashboard Report',
        margin,
        pageHeight - 10
      );
    }

    // Save the PDF
    const filename = `dashboard-${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(filename);

    logger.info('PDF export completed successfully');
  } catch (error) {
    logger.error('Failed to export PDF', error);
    throw new Error('PDF export failed');
  }
}

async function addKPISummaryToPDF(
  pdf: jsPDF,
  kpiSummary: any,
  yPosition: number,
  margin: number,
  pageWidth: number
): Promise<number> {
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Key Performance Indicators', margin, yPosition);
  yPosition += 10;

  const kpiData = [
    ['Total Tickets', kpiSummary.total_tickets?.toString() || '0'],
    ['Open Tickets', kpiSummary.open_tickets?.toString() || '0'],
    ['Resolved Today', kpiSummary.resolved_today?.toString() || '0'],
    ['SLA Compliance', `${((kpiSummary.sla_response_met / kpiSummary.total_sla_tracked) * 100 || 0).toFixed(1)}%`],
    ['Avg Response Time', `${kpiSummary.avg_response_time?.toFixed(1) || '0'} min`],
    ['Avg Resolution Time', `${kpiSummary.avg_resolution_time?.toFixed(1) || '0'} hours`],
    ['Customer Satisfaction', `${kpiSummary.csat_score?.toFixed(1) || '0'}/5.0`]
  ];

  autoTable(pdf, {
    startY: yPosition,
    head: [['Metric', 'Value']],
    body: kpiData,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246], fontSize: 11, fontStyle: 'bold' },
    styles: { fontSize: 10 },
    margin: { left: margin, right: margin }
  });

  return (pdf as any).lastAutoTable.finalY + 15;
}

async function addWidgetToPDF(
  pdf: jsPDF,
  widget: any,
  yPosition: number,
  margin: number,
  pageWidth: number,
  pageHeight: number
): Promise<number> {
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text(widget.title || 'Widget', margin, yPosition);
  yPosition += 8;

  // Try to capture widget as image (for charts)
  try {
    const widgetElement = document.getElementById(widget.id);
    if (widgetElement) {
      const canvas = await html2canvas(widgetElement, {
        scale: 2,
        logging: false,
        useCORS: true
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = pageWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Check if image fits on current page
      if (yPosition + imgHeight > pageHeight - 20) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 10;
    }
  } catch (error) {
    logger.warn('Failed to capture widget as image', error);
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(10);
    pdf.text('Chart visualization not available in PDF export', margin, yPosition);
    yPosition += 10;
  }

  return yPosition;
}

// ============================================================================
// Excel Export
// ============================================================================

export async function exportToExcel(options: ExportOptions): Promise<void> {
  const {
    title,
    widgets = [],
    metrics,
    includeCharts = true
  } = options;

  try {
    const workbook = XLSX.utils.book_new();

    // Add summary sheet
    if (metrics?.kpiSummary) {
      const summaryData = [
        ['ServiceDesk Dashboard Report'],
        ['Generated:', new Date().toLocaleString()],
        [],
        ['Key Performance Indicators'],
        ['Metric', 'Value'],
        ['Total Tickets', metrics.kpiSummary.total_tickets || 0],
        ['Open Tickets', metrics.kpiSummary.open_tickets || 0],
        ['Resolved Today', metrics.kpiSummary.resolved_today || 0],
        ['Tickets This Week', metrics.kpiSummary.tickets_this_week || 0],
        ['Tickets This Month', metrics.kpiSummary.tickets_this_month || 0],
        [],
        ['SLA Metrics'],
        ['Metric', 'Value'],
        ['SLA Response Met', metrics.kpiSummary.sla_response_met || 0],
        ['SLA Resolution Met', metrics.kpiSummary.sla_resolution_met || 0],
        ['Total SLA Tracked', metrics.kpiSummary.total_sla_tracked || 0],
        ['SLA Compliance Rate', `${((metrics.kpiSummary.sla_response_met / metrics.kpiSummary.total_sla_tracked) * 100 || 0).toFixed(1)}%`],
        [],
        ['Performance Metrics'],
        ['Metric', 'Value'],
        ['Avg Response Time (min)', metrics.kpiSummary.avg_response_time?.toFixed(1) || '0'],
        ['Avg Resolution Time (hours)', metrics.kpiSummary.avg_resolution_time?.toFixed(1) || '0'],
        ['First Contact Resolution Rate', `${metrics.kpiSummary.fcr_rate?.toFixed(1) || '0'}%`],
        ['Customer Satisfaction Score', `${metrics.kpiSummary.csat_score?.toFixed(1) || '0'}/5.0`],
        ['CSAT Responses', metrics.kpiSummary.csat_responses || 0]
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

      // Set column widths
      summarySheet['!cols'] = [
        { wch: 35 },
        { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    }

    // Add data sheets for each widget
    if (metrics?.slaData && metrics.slaData.length > 0) {
      const slaSheet = XLSX.utils.json_to_sheet(metrics.slaData);
      XLSX.utils.book_append_sheet(workbook, slaSheet, 'SLA Performance');
    }

    if (metrics?.agentData && metrics.agentData.length > 0) {
      const agentSheet = XLSX.utils.json_to_sheet(metrics.agentData);
      XLSX.utils.book_append_sheet(workbook, agentSheet, 'Agent Performance');
    }

    if (metrics?.volumeData && metrics.volumeData.length > 0) {
      const volumeSheet = XLSX.utils.json_to_sheet(metrics.volumeData);
      XLSX.utils.book_append_sheet(workbook, volumeSheet, 'Ticket Volume');
    }

    if (metrics?.customData) {
      const customData = Object.entries(metrics.customData).map(([key, value]) => ({
        Metric: (value as any).label || key,
        Value: (value as any).value,
        Unit: (value as any).unit || '',
        Change: (value as any).change || 0,
        Target: (value as any).target || ''
      }));

      if (customData.length > 0) {
        const customSheet = XLSX.utils.json_to_sheet(customData);
        XLSX.utils.book_append_sheet(workbook, customSheet, 'Custom Metrics');
      }
    }

    // Generate and download Excel file
    const filename = `dashboard-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);

    logger.info('Excel export completed successfully');
  } catch (error) {
    logger.error('Failed to export Excel', error);
    throw new Error('Excel export failed');
  }
}

// ============================================================================
// Scheduled Export
// ============================================================================

export interface ScheduledExportConfig {
  dashboardId: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  format: 'pdf' | 'excel';
  recipients: string[];
  enabled: boolean;
}

export async function scheduleExport(config: ScheduledExportConfig): Promise<void> {
  // This would integrate with a job scheduler (e.g., Bull, node-cron)
  // For now, we'll just log the configuration

  logger.info('Export scheduled', { config });

  // In production, this would:
  // 1. Store the schedule configuration in the database
  // 2. Create a recurring job in the job queue
  // 3. When the job runs, generate the export and email it to recipients
}

export async function cancelScheduledExport(dashboardId: string): Promise<void> {
  logger.info('Export schedule cancelled', { dashboardId });

  // In production, this would:
  // 1. Remove the schedule from the database
  // 2. Cancel the recurring job
}
