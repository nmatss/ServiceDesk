/**
 * PWA Status API Route
 * Returns PWA capabilities and status information
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateVapidConfig } from '@/lib/pwa/vapid-manager';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const vapidStatus = validateVapidConfig();

    const pwaStatus = {
      pwa: {
        enabled: true,
        version: '2.0.0',
      },
      serviceWorker: {
        supported: true,
        path: '/sw.js',
      },
      pushNotifications: {
        supported: true,
        vapid: vapidStatus.valid,
        vapidMessage: vapidStatus.message,
      },
      backgroundSync: {
        supported: true,
        tags: ['sync-actions', 'sync-tickets', 'sync-comments'],
      },
      periodicSync: {
        supported: false, // Requires user permission and is limited
        interval: 'Not configured',
      },
      offline: {
        supported: true,
        cacheStrategies: [
          'Network First (API)',
          'Cache First (Static Assets)',
          'Stale While Revalidate (KB Articles)',
        ],
      },
      installPrompt: {
        supported: true,
        criteria: [
          'HTTPS required',
          'Valid manifest.json',
          'Service worker registered',
          'Not already installed',
        ],
      },
      capabilities: {
        createTicketOffline: true,
        viewTicketsOffline: true,
        searchKBOffline: true,
        backgroundNotifications: true,
        installable: true,
        shareTarget: true,
        fileHandlers: true,
      },
    };

    return NextResponse.json(pwaStatus, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to retrieve PWA status',
        message: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    );
  }
}
