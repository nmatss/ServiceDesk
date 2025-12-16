/**
 * Chart Export Utilities
 *
 * Functions for exporting charts as images (PNG, SVG) and data (CSV, JSON).
 * Supports both client-side and server-side export.
 *
 * @module lib/charts/export-chart
 */

/**
 * Export chart as PNG using HTML canvas
 */
export async function exportChartAsPNG(
  svgElement: SVGElement,
  filename: string,
  options: { width?: number; height?: number; backgroundColor?: string } = {}
): Promise<void> {
  const { width, height, backgroundColor = 'white' } = options;

  // Get SVG dimensions
  const svgRect = svgElement.getBoundingClientRect();
  const svgWidth = width || svgRect.width;
  const svgHeight = height || svgRect.height;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = svgWidth * 2; // 2x for better quality
  canvas.height = svgHeight * 2;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Scale for high DPI
  ctx.scale(2, 2);

  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, svgWidth, svgHeight);

  // Convert SVG to data URL
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  // Load SVG into image
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
    URL.revokeObjectURL(url);

    // Convert canvas to blob and download
    canvas.toBlob(blob => {
      if (blob) {
        downloadBlob(blob, filename);
      }
    }, 'image/png');
  };

  img.src = url;
}

/**
 * Export chart as SVG
 */
export function exportChartAsSVG(svgElement: SVGElement, filename: string): void {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(svgBlob, filename);
}

/**
 * Export data as CSV
 */
export function exportDataAsCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: Array<{ key: keyof T; label: string }>
): void {
  if (data.length === 0) return;

  // Determine columns
  const cols = columns || Object.keys(data[0]).map(key => ({ key, label: key }));

  // Create CSV header
  const header = cols.map(col => escapeCSVValue(col.label)).join(',');

  // Create CSV rows
  const rows = data.map(row =>
    cols.map(col => escapeCSVValue(String(row[col.key] ?? ''))).join(',')
  );

  // Combine and download
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Export data as JSON
 */
export function exportDataAsJSON<T>(data: T, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Export data as Excel-compatible CSV
 */
export function exportDataAsExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: Array<{ key: keyof T; label: string }>
): void {
  if (data.length === 0) return;

  // Determine columns
  const cols = columns || Object.keys(data[0]).map(key => ({ key, label: key }));

  // Create CSV with UTF-8 BOM for Excel
  const bom = '\uFEFF';
  const header = cols.map(col => escapeCSVValue(col.label)).join(',');
  const rows = data.map(row =>
    cols.map(col => escapeCSVValue(String(row[col.key] ?? ''))).join(',')
  );

  const csv = bom + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename);
}

/**
 * Copy chart to clipboard
 */
export async function copyChartToClipboard(svgElement: SVGElement): Promise<void> {
  try {
    // Convert SVG to PNG blob
    const canvas = document.createElement('canvas');
    const svgRect = svgElement.getBoundingClientRect();
    canvas.width = svgRect.width * 2;
    canvas.height = svgRect.height * 2;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    ctx.scale(2, 2);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, svgRect.width, svgRect.height);

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    ctx.drawImage(img, 0, 0, svgRect.width, svgRect.height);
    URL.revokeObjectURL(url);

    // Copy to clipboard
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(blob => resolve(blob!), 'image/png');
    });

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);
  } catch (error) {
    console.error('Failed to copy chart to clipboard:', error);
    throw error;
  }
}

/**
 * Print chart
 */
export function printChart(svgElement: SVGElement, title?: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window');
  }

  const svgData = new XMLSerializer().serializeToString(svgElement);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title || 'Chart'}</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          svg {
            max-width: 100%;
            height: auto;
          }
          h1 {
            font-family: system-ui, -apple-system, sans-serif;
            color: #111827;
            margin-bottom: 20px;
          }
          @media print {
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${title ? `<h1>${title}</h1>` : ''}
        ${svgData}
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

// Helper functions

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCSVValue(value: string): string {
  // Escape double quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate filename with timestamp
 */
export function generateFilename(prefix: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${prefix}-${timestamp}.${extension}`;
}

/**
 * Check if clipboard API is available
 */
export function isClipboardAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'clipboard' in navigator && 'write' in navigator.clipboard;
}
