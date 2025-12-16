/**
 * Email Automation System - Usage Examples
 * Complete examples for all common email automation scenarios
 */

import { emailSender } from '@/lib/integrations/email/sender';
import { emailParser } from '@/lib/integrations/email/parser';
import { templateEngine } from '@/lib/integrations/email/templates';
import { emailAutomation } from '@/lib/integrations/email/automation';

// ============================================================================
// EXAMPLE 1: Send Ticket Created Email
// ============================================================================

export async function example1_sendTicketCreatedEmail() {
  const result = await emailSender.queueTemplate(
    'ticket_created',
    'customer@example.com',
    {
      ticketNumber: 'TKT-000123',
      ticket: {
        id: 123,
        title: 'Cannot login to system',
        description: 'User experiencing login issues when trying to access the portal.',
        priority: 'Alta',
        status: 'Aberto',
        createdAt: new Date(),
      },
      customer: {
        name: 'John Doe',
        email: 'customer@example.com',
      },
      tenant: {
        name: 'Acme Corp',
        supportEmail: 'support@acme.com',
      },
    },
    1, // tenantId
    { priority: 'high' }
  );

  if (result) {
    console.log('Email queued successfully:', result);
  }
}

// ============================================================================
// EXAMPLE 2: Send SLA Warning Email to Agent
// ============================================================================

export async function example2_sendSLAWarning() {
  await emailSender.queueTemplate(
    'sla_warning',
    'agent@example.com',
    {
      ticketNumber: 'TKT-000456',
      ticket: {
        id: 456,
        title: 'Critical server outage',
        priority: 'Crítica',
      },
      agent: {
        name: 'Jane Smith',
      },
      sla: {
        deadline: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        timeRemaining: '1 hora',
      },
      tenant: {
        name: 'Acme Corp',
      },
    },
    1,
    { priority: 'high' }
  );
}

// ============================================================================
// EXAMPLE 3: Send Custom Email (Not Using Template)
// ============================================================================

export async function example3_sendCustomEmail() {
  const queueId = await emailSender.queue({
    to: ['user1@example.com', 'user2@example.com'],
    cc: ['manager@example.com'],
    subject: 'Important System Update',
    html: `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h1 style="color: #2563eb;">System Update Notice</h1>
          <p>We will be performing scheduled maintenance on Saturday.</p>
          <ul>
            <li>Start: 02:00 AM</li>
            <li>Duration: 2 hours</li>
            <li>Impact: Full system unavailable</li>
          </ul>
          <p>Thank you for your patience.</p>
        </body>
      </html>
    `,
    text: `
System Update Notice

We will be performing scheduled maintenance on Saturday.

- Start: 02:00 AM
- Duration: 2 hours
- Impact: Full system unavailable

Thank you for your patience.
    `,
    priority: 'high',
  }, 1);

  console.log('Custom email queued:', queueId);
}

// ============================================================================
// EXAMPLE 4: Send Email Immediately (Without Queue)
// ============================================================================

export async function example4_sendEmailImmediately() {
  const result = await emailSender.send({
    to: 'urgent@example.com',
    subject: 'Urgent: System Alert',
    html: '<h1>Critical Alert</h1><p>Immediate action required!</p>',
    text: 'Critical Alert - Immediate action required!',
    priority: 'high',
  });

  if (result.success) {
    console.log('Email sent immediately:', result.messageId);
  } else {
    console.error('Email failed:', result.error);
  }
}

// ============================================================================
// EXAMPLE 5: Send Email with Attachments
// ============================================================================

export async function example5_sendEmailWithAttachments() {
  await emailSender.queue({
    to: 'customer@example.com',
    subject: 'Your Invoice',
    html: '<h1>Invoice Attached</h1><p>Please find your invoice attached.</p>',
    text: 'Invoice Attached - Please find your invoice attached.',
    attachments: [
      {
        filename: 'invoice-123.pdf',
        path: '/path/to/invoice-123.pdf',
        contentType: 'application/pdf',
      },
      {
        filename: 'logo.png',
        content: Buffer.from('...'), // File buffer
        contentType: 'image/png',
        cid: 'logo@servicedesk', // For embedding in HTML
      },
    ],
    priority: 'normal',
  }, 1);
}

// ============================================================================
// EXAMPLE 6: Parse Incoming Email and Create Ticket
// ============================================================================

export async function example6_parseIncomingEmail() {
  // Simulated incoming email
  const rawEmail = `From: customer@example.com
To: support@servicedesk.com
Subject: Need help with password reset
Date: Thu, 05 Dec 2024 10:00:00 +0000
Message-ID: <abc123@example.com>
Content-Type: text/plain; charset=utf-8

Hello,

I cannot reset my password. The reset link is not working.

Please help!

Thanks,
John
`;

  // Parse email
  const parsed = await emailParser.parse(Buffer.from(rawEmail));

  console.log('Parsed email:');
  console.log('- From:', parsed.from.email);
  console.log('- Subject:', parsed.subject);
  console.log('- Body:', parsed.body.text);
  console.log('- Has ticket ref:', !!parsed.ticketReference);

  // Process and create ticket
  const result = await emailAutomation.processIncomingEmail(rawEmail, 1);

  console.log('Result:', result);
  console.log('Ticket ID:', result.ticketId);
}

// ============================================================================
// EXAMPLE 7: Handle Email Reply to Existing Ticket
// ============================================================================

export async function example7_handleEmailReply() {
  // Email replying to existing ticket
  const rawEmail = `From: customer@example.com
Subject: Re: Ticket #123 - Password Reset Issue
In-Reply-To: <ticket-123@servicedesk.com>
References: <ticket-123@servicedesk.com>

I tried that but it's still not working. Can you help?
`;

  const result = await emailAutomation.processIncomingEmail(rawEmail, 1);

  console.log('Action:', result.action); // Should be 'comment_added'
  console.log('Ticket ID:', result.ticketId); // Should be 123
}

// ============================================================================
// EXAMPLE 8: Create Custom Email Template
// ============================================================================

export async function example8_createCustomTemplate() {
  const template = {
    name: 'Weekly Report',
    code: 'weekly_report',
    subject: 'Weekly Report - {{week}}',
    bodyHtml: `
      <html>
        <body>
          <h1>Weekly Report for {{week}}</h1>
          <h2>Statistics</h2>
          <ul>
            <li>Tickets Created: {{stats.created}}</li>
            <li>Tickets Resolved: {{stats.resolved}}</li>
            <li>Response Time: {{stats.avgResponseTime}}</li>
          </ul>
          <p>Great work, {{agent.name}}!</p>
        </body>
      </html>
    `,
    bodyText: `
Weekly Report for {{week}}

Statistics:
- Tickets Created: {{stats.created}}
- Tickets Resolved: {{stats.resolved}}
- Response Time: {{stats.avgResponseTime}}

Great work, {{agent.name}}!
    `,
    language: 'pt-BR',
    category: 'custom',
    variables: ['week', 'stats.created', 'stats.resolved', 'stats.avgResponseTime', 'agent.name'],
    isActive: true,
  };

  // Save template
  const templateId = await templateEngine.saveTemplate(template);
  console.log('Template created:', templateId);

  // Use template
  await emailSender.queueTemplate(
    'weekly_report',
    'agent@example.com',
    {
      week: 'Week 49 - 2024',
      stats: {
        created: 45,
        resolved: 42,
        avgResponseTime: '2.5 hours',
      },
      agent: {
        name: 'Jane Smith',
      },
    },
    1
  );
}

// ============================================================================
// EXAMPLE 9: Render Template Preview
// ============================================================================

export async function example9_renderTemplatePreview() {
  const rendered = templateEngine.render('ticket_created', {
    ticketNumber: 'TKT-999999',
    ticket: {
      id: 999999,
      title: 'Sample Ticket for Preview',
      description: 'This is a sample ticket to preview the email template.',
      priority: 'Média',
      status: 'Aberto',
      createdAt: new Date(),
    },
    customer: {
      name: 'Preview User',
      email: 'preview@example.com',
    },
    tenant: {
      name: 'Preview Company',
      supportEmail: 'support@preview.com',
    },
  });

  console.log('Subject:', rendered.subject);
  console.log('HTML Preview:', rendered.html.substring(0, 200) + '...');
  console.log('Text Preview:', rendered.text.substring(0, 200) + '...');

  return rendered;
}

// ============================================================================
// EXAMPLE 10: Get Email Queue Statistics
// ============================================================================

export async function example10_getEmailStats() {
  const stats = await emailSender.getStats(1);

  console.log('Email Queue Statistics:');
  console.log('- Total emails:', stats.total);
  console.log('- Pending:', stats.pending);
  console.log('- Sending:', stats.sending);
  console.log('- Sent:', stats.sent);
  console.log('- Failed:', stats.failed);
  console.log('- Bounced:', stats.bounced);
  console.log('- High priority:', stats.highPriority);
  console.log('- Normal priority:', stats.normalPriority);
  console.log('- Low priority:', stats.lowPriority);

  return stats;
}

// ============================================================================
// EXAMPLE 11: Process Email Queue Manually
// ============================================================================

export async function example11_processQueueManually() {
  // Process up to 50 emails from queue
  await emailSender.processQueue(50);

  console.log('Email queue processed');
}

// ============================================================================
// EXAMPLE 12: Retry Failed Emails
// ============================================================================

export async function example12_retryFailedEmails() {
  const retryCount = await emailSender.retryFailed(1);

  console.log(`Retried ${retryCount} failed emails`);
}

// ============================================================================
// EXAMPLE 13: Clean Old Emails
// ============================================================================

export async function example13_cleanOldEmails() {
  // Delete emails older than 30 days
  const deletedCount = await emailSender.clearOld(30, 1);

  console.log(`Deleted ${deletedCount} old emails`);
}

// ============================================================================
// EXAMPLE 14: Schedule Email for Later
// ============================================================================

export async function example14_scheduleEmail() {
  // Schedule email for tomorrow 9 AM
  const tomorrow9am = new Date();
  tomorrow9am.setDate(tomorrow9am.getDate() + 1);
  tomorrow9am.setHours(9, 0, 0, 0);

  await emailSender.queue({
    to: 'customer@example.com',
    subject: 'Scheduled Reminder',
    html: '<p>This is your scheduled reminder!</p>',
    text: 'This is your scheduled reminder!',
    priority: 'normal',
    // scheduled_at: tomorrow9am, // Would need to add this to queue method
  }, 1);
}

// ============================================================================
// EXAMPLE 15: Use Template Helpers
// ============================================================================

export async function example15_useTemplateHelpers() {
  // Create template using helpers
  const template = {
    name: 'Helper Example',
    code: 'helper_example',
    subject: 'Invoice for {{uppercase customer.name}}',
    bodyHtml: `
      <html>
        <body>
          <h1>Invoice</h1>
          <p>Customer: {{capitalize customer.name}}</p>
          <p>Date: {{formatDate invoice.date}}</p>
          <p>Amount: {{currency invoice.amount}}</p>
          <p>Description: {{truncate invoice.description 50}}</p>

          {{#if eq invoice.status "paid"}}
            <p style="color: green;">✓ Paid</p>
          {{else}}
            <p style="color: red;">⚠ Unpaid</p>
          {{/if}}

          <p>View: <a href="{{ticketUrl invoice.id}}">Click here</a></p>
        </body>
      </html>
    `,
    bodyText: `
Invoice

Customer: {{customer.name}}
Date: {{formatDate invoice.date}}
Amount: {{currency invoice.amount}}
    `,
    language: 'pt-BR',
    category: 'custom',
    variables: ['customer.name', 'invoice.date', 'invoice.amount', 'invoice.description', 'invoice.status', 'invoice.id'],
    isActive: true,
  };

  await templateEngine.saveTemplate(template);

  // Use template
  const rendered = templateEngine.render('helper_example', {
    customer: {
      name: 'john doe',
    },
    invoice: {
      id: 123,
      date: new Date(),
      amount: 1234.56,
      description: 'This is a very long description that will be truncated to fit in the email preview section',
      status: 'paid',
    },
  });

  console.log('Rendered:', rendered.subject);
}

// ============================================================================
// Run Examples
// ============================================================================

export async function runAllExamples() {
  console.log('=== Email Automation Examples ===\n');

  try {
    console.log('Example 1: Send ticket created email');
    await example1_sendTicketCreatedEmail();
    console.log('✓ Complete\n');

    console.log('Example 2: Send SLA warning');
    await example2_sendSLAWarning();
    console.log('✓ Complete\n');

    console.log('Example 9: Render template preview');
    await example9_renderTemplatePreview();
    console.log('✓ Complete\n');

    console.log('Example 10: Get email stats');
    await example10_getEmailStats();
    console.log('✓ Complete\n');

    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export all examples
export default {
  example1_sendTicketCreatedEmail,
  example2_sendSLAWarning,
  example3_sendCustomEmail,
  example4_sendEmailImmediately,
  example5_sendEmailWithAttachments,
  example6_parseIncomingEmail,
  example7_handleEmailReply,
  example8_createCustomTemplate,
  example9_renderTemplatePreview,
  example10_getEmailStats,
  example11_processQueueManually,
  example12_retryFailedEmails,
  example13_cleanOldEmails,
  example14_scheduleEmail,
  example15_useTemplateHelpers,
  runAllExamples,
};
