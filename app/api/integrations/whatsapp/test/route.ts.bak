/**
 * WhatsApp Connection Test API
 * Test WhatsApp Business API connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/sqlite-auth';
import logger from '@/lib/monitoring/structured-logger';

/**
 * POST - Test WhatsApp connection
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.authenticated || !['admin', 'manager'].includes(authResult.user?.role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get configuration
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

    if (!phoneNumberId || !accessToken || !businessAccountId) {
      return NextResponse.json({
        connected: false,
        error: 'WhatsApp configuration incomplete',
        missing: {
          phoneNumberId: !phoneNumberId,
          accessToken: !accessToken,
          businessAccountId: !businessAccountId,
        },
      });
    }

    // Test API connection by fetching phone number info
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error('WhatsApp connection test failed', { error });

      return NextResponse.json({
        connected: false,
        error: error.error?.message || 'Failed to connect to WhatsApp API',
        details: error,
      });
    }

    const data = await response.json();

    logger.info('WhatsApp connection test successful', {
      phoneNumberId,
      displayPhoneNumber: data.display_phone_number,
    });

    return NextResponse.json({
      connected: true,
      phoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      qualityRating: data.quality_rating,
    });
  } catch (error) {
    logger.error('Error testing WhatsApp connection', { error });

    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
