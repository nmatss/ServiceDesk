/**
 * Virus Scanner — VirusTotal API integration for file upload security
 * Gracefully degrades when VIRUSTOTAL_API_KEY is not configured
 */

import { logger } from '@/lib/monitoring/logger';

export interface ScanResult {
  safe: boolean;
  skipped: boolean;
  threat?: string;
}

/**
 * Scan a file buffer for viruses using VirusTotal API v3
 * If VIRUSTOTAL_API_KEY is not set, returns safe with skipped=true
 */
export async function scanFile(buffer: Buffer, filename: string): Promise<ScanResult> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;

  if (!apiKey) {
    logger.warn('VIRUSTOTAL_API_KEY not configured — virus scanning skipped', { filename });
    return { safe: true, skipped: true };
  }

  try {
    // Upload file to VirusTotal
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(buffer)]), filename);

    const uploadResponse = await fetch('https://www.virustotal.com/api/v3/files', {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
      },
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!uploadResponse.ok) {
      logger.warn('VirusTotal upload failed', {
        filename,
        status: uploadResponse.status,
      });
      // Graceful degradation — allow upload if API fails
      return { safe: true, skipped: true };
    }

    const uploadData = await uploadResponse.json();
    const analysisId = uploadData.data?.id;

    if (!analysisId) {
      logger.warn('VirusTotal returned no analysis ID', { filename });
      return { safe: true, skipped: true };
    }

    // Poll for analysis result (up to 60 seconds)
    const maxAttempts = 12;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000));

      const analysisResponse = await fetch(
        `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
        {
          headers: { 'x-apikey': apiKey },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!analysisResponse.ok) continue;

      const analysisData = await analysisResponse.json();
      const status = analysisData.data?.attributes?.status;

      if (status === 'completed') {
        const stats = analysisData.data?.attributes?.stats || {};
        const malicious = (stats.malicious || 0) + (stats.suspicious || 0);

        if (malicious > 0) {
          logger.warn('VirusTotal detected threat', { filename, malicious, stats });
          return {
            safe: false,
            skipped: false,
            threat: `Detected by ${malicious} engines`,
          };
        }

        logger.info('VirusTotal scan clean', { filename });
        return { safe: true, skipped: false };
      }
    }

    // Timeout waiting for analysis — allow but log
    logger.warn('VirusTotal analysis timed out', { filename, analysisId });
    return { safe: true, skipped: true };
  } catch (error) {
    logger.error('Virus scan error', { filename, error });
    // Graceful degradation
    return { safe: true, skipped: true };
  }
}
