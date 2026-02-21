# Email Automation System - Complete Guide

## Overview

The ServiceDesk Email Automation System is a comprehensive solution for managing all email communications in the platform. It includes incoming email parsing, template management, automated workflows, and delivery tracking.

## Features

### 1. **Email Parser** (`lib/integrations/email/parser.ts`)
- Parse incoming emails from IMAP/POP3 or webhooks
- Extract headers, body, attachments
- Match senders to existing users
- Detect ticket references in subject/body
- Handle email threading (In-Reply-To, References)
- Identify auto-replies and bounces

### 2. **Template Engine** (`lib/integrations/email/templates.ts`)
- Handlebars-based templating
- HTML and plain text versions
- Custom helpers (dates, formatting, badges)
- Multi-language support
- Variable validation
- Template caching for performance

### 3. **Email Sender** (`lib/integrations/email/sender.ts`)
- Nodemailer SMTP integration
- Priority-based queue management
- Retry logic with exponential backoff
- Rate limiting
- Connection pooling
- Delivery tracking

### 4. **Automation Engine** (`lib/integrations/email/automation.ts`)
- Auto-create tickets from emails
- Auto-respond with templates
- Routing rules (sender, subject, content)
- SLA notifications
- Auto-assignment based on rules
- Email threading and conversation tracking

## Installation

### 1. Install Dependencies

```bash
npm install imapflow mailparser --legacy-peer-deps
```

### 2. Run Database Migration

```bash
sqlite3 servicedesk.db < lib/db/migrations/010_email_integration.sql
```

Or run the init script:
```bash
npm run init-db
```

### 3. Configure Environment Variables

Add to your `.env` file:

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email Settings
EMAIL_FROM_NAME=ServiceDesk
EMAIL_FROM_ADDRESS=noreply@servicedesk.com
EMAIL_RATE_LIMIT=100

# IMAP Configuration (Optional - for incoming email)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password

# Webhook Security
EMAIL_WEBHOOK_SECRET=your-secret-key

# Application URL
APP_URL=https://your-domain.com
SUPPORT_EMAIL=support@your-domain.com
```

## Usage

### Sending Emails

#### Using Templates

```typescript
import { emailSender } from '@/lib/integrations/email/sender';

// Send ticket created email
await emailSender.queueTemplate(
  'ticket_created',
  'customer@example.com',
  {
    ticketNumber: 'TKT-000123',
    ticket: {
      id: 123,
      title: 'Cannot login to system',
      description: 'User experiencing login issues',
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
```

#### Custom Emails

```typescript
// Queue custom email
await emailSender.queue({
  to: 'user@example.com',
  subject: 'Welcome to ServiceDesk',
  html: '<h1>Welcome!</h1><p>Thank you for joining.</p>',
  text: 'Welcome! Thank you for joining.',
  priority: 'normal',
}, 1); // tenantId
```

#### Send Immediately

```typescript
// Send without queuing
const result = await emailSender.send({
  to: 'user@example.com',
  subject: 'Urgent Notification',
  html: '<p>This is urgent!</p>',
  text: 'This is urgent!',
  priority: 'high',
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

### Processing Incoming Emails

#### Via Webhook

Configure your email service (SendGrid, Mailgun, etc.) to POST incoming emails to:

```
POST https://your-domain.com/api/integrations/email/webhook
Authorization: Bearer YOUR_WEBHOOK_SECRET
```

The webhook will:
1. Parse the email
2. Check for ticket references
3. Add comment to existing ticket OR create new ticket
4. Send confirmation email
5. Notify assigned agents

#### Via IMAP (Planned)

```typescript
import { emailAutomation } from '@/lib/integrations/email/automation';
import { EmailAutomation } from '@/lib/integrations/email-automation';

const emailSystem = new EmailAutomation();
await emailSystem.startIMAPMonitoring();
```

### Managing Templates

#### Create Template

```bash
POST /api/integrations/email/templates
```

```json
{
  "name": "Custom Welcome",
  "code": "custom_welcome",
  "subject": "Welcome {{name}}!",
  "bodyHtml": "<h1>Welcome {{name}}</h1>",
  "bodyText": "Welcome {{name}}",
  "language": "pt-BR",
  "category": "user",
  "variables": ["name"]
}
```

#### Update Template

```bash
PUT /api/integrations/email/templates/1
```

```json
{
  "subject": "Updated subject",
  "bodyHtml": "<h1>Updated content</h1>"
}
```

#### List Templates

```bash
GET /api/integrations/email/templates?category=ticket&active=true
```

### Automation Rules

Automation rules are stored in the `email_automation_rules` table and execute based on triggers and conditions.

#### Example: Auto-assign urgent emails

```sql
INSERT INTO email_automation_rules (
  tenant_id, name, trigger_type, conditions, actions, priority, is_active
) VALUES (
  1,
  'Auto-assign Urgent',
  'incoming_email',
  '[{"field":"subject","operator":"contains","value":"urgent","caseSensitive":false}]',
  '[{"type":"set_priority","params":{"priorityId":"4"}},{"type":"assign_to","params":{"userId":5}}]',
  10,
  1
);
```

This rule will:
- Trigger on incoming emails
- Check if subject contains "urgent"
- Set priority to Critical (ID 4)
- Assign to user ID 5

## API Reference

### Email Webhook

```
POST /api/integrations/email/webhook
```

**Headers:**
- `Authorization: Bearer YOUR_WEBHOOK_SECRET`

**Body:** Raw email or JSON with email data

**Response:**
```json
{
  "success": true,
  "ticketId": 123,
  "action": "ticket_created"
}
```

### Send Email

```
POST /api/integrations/email/send
```

**Body:**
```json
{
  "to": "user@example.com",
  "templateCode": "ticket_created",
  "templateData": { ... },
  "priority": "high",
  "queue": true
}
```

OR

```json
{
  "to": "user@example.com",
  "subject": "Custom Email",
  "html": "<p>Content</p>",
  "text": "Content",
  "priority": "normal"
}
```

### Templates Management

```
GET /api/integrations/email/templates
POST /api/integrations/email/templates
PUT /api/integrations/email/templates/:id
DELETE /api/integrations/email/templates/:id
```

## Database Schema

### email_templates
- Stores HTML and text versions of email templates
- Supports multi-language
- JSON variable validation

### email_queue
- Priority-based queue (high, normal, low)
- Retry logic with max attempts
- Status tracking (pending, sending, sent, failed, bounced)
- Scheduled sending support

### email_automation_rules
- Trigger types: incoming_email, ticket_created, ticket_updated, sla_warning
- JSON-based conditions and actions
- Priority ordering

### email_threads
- Conversation tracking
- Message-ID threading
- Attachment management

### email_tracking
- Delivery events (sent, delivered, opened, clicked, bounced)
- IP and user-agent tracking

## Template Variables

### Common Variables

All templates have access to:
- `{{tenant.name}}` - Tenant name
- `{{tenant.supportEmail}}` - Support email
- `{{tenant.url}}` - Tenant URL

### Ticket Templates

- `{{ticketNumber}}` - Ticket number (e.g., TKT-000123)
- `{{ticket.id}}` - Ticket ID
- `{{ticket.title}}` - Ticket title
- `{{ticket.description}}` - Ticket description
- `{{ticket.priority}}` - Priority name
- `{{ticket.status}}` - Status name
- `{{ticket.createdAt}}` - Creation date
- `{{ticket.assignedTo}}` - Assigned agent name
- `{{customer.name}}` - Customer name
- `{{customer.email}}` - Customer email

### User Templates

- `{{name}}` - User name
- `{{email}}` - User email
- `{{password}}` - Temporary password (if applicable)
- `{{urls.loginUrl}}` - Login URL
- `{{urls.resetUrl}}` - Password reset URL

### Custom Helpers

- `{{formatDate date}}` - Format date (DD/MM/YYYY)
- `{{formatDateTime date}}` - Format date and time
- `{{formatTime date}}` - Format time only
- `{{uppercase string}}` - Convert to uppercase
- `{{lowercase string}}` - Convert to lowercase
- `{{capitalize string}}` - Capitalize first letter
- `{{truncate string length}}` - Truncate string
- `{{currency value}}` - Format as currency (BRL)
- `{{number value}}` - Format number
- `{{ticketUrl ticketId}}` - Generate ticket URL
- `{{portalUrl path}}` - Generate portal URL
- `{{{priorityBadge priority}}}` - Render priority badge (HTML)
- `{{{statusBadge status}}}` - Render status badge (HTML)

## Testing

### Test SMTP Connection

```typescript
import { emailSender } from '@/lib/integrations/email/sender';

const isConnected = await emailSender.verifyConnection();
console.log('SMTP OK:', isConnected);
```

### Send Test Email

```bash
POST /api/integrations/email/send
```

```json
{
  "to": "your-email@example.com",
  "subject": "Test Email",
  "html": "<h1>Test</h1>",
  "text": "Test",
  "queue": false
}
```

### Test Template Rendering

```typescript
import { templateEngine } from '@/lib/integrations/email/templates';

const rendered = templateEngine.render('ticket_created', {
  ticketNumber: 'TEST-001',
  ticket: { title: 'Test Ticket', ... },
  customer: { name: 'Test User', email: 'test@example.com' },
  tenant: { name: 'Test Corp' },
});

console.log('Subject:', rendered.subject);
console.log('HTML:', rendered.html);
console.log('Text:', rendered.text);
```

## Troubleshooting

### Emails not sending

1. Check SMTP configuration in `.env`
2. Verify SMTP connection: `await emailSender.verifyConnection()`
3. Check email queue status
4. Review logs for errors

### Incoming emails not creating tickets

1. Verify webhook URL is accessible
2. Check webhook secret matches
3. Review webhook logs
4. Test with a manual POST request

### Templates not rendering

1. Check template exists: `GET /api/integrations/email/templates`
2. Verify all required variables are provided
3. Review template compilation errors in logs

## Performance Tips

1. **Use Queue for Bulk Sending**: Always queue emails instead of sending immediately for better performance
2. **Rate Limiting**: Configure `EMAIL_RATE_LIMIT` based on your SMTP provider limits
3. **Template Caching**: Templates are automatically cached after first compilation
4. **Connection Pooling**: SMTP connection pooling is enabled by default (max 5 connections)
5. **Clean Old Emails**: Periodically clean old sent/failed emails from queue

## Security

1. **Webhook Secret**: Always use a strong webhook secret
2. **SMTP Credentials**: Use environment variables, never commit credentials
3. **Input Validation**: All email addresses and content are validated
4. **XSS Prevention**: HTML content is sanitized
5. **Rate Limiting**: Prevents abuse of email sending

## Future Enhancements

- [ ] Email open tracking (pixel tracking)
- [ ] Click tracking
- [ ] Bounce handling automation
- [ ] DKIM/SPF verification
- [ ] Email signature management
- [ ] Rich text editor for templates
- [ ] A/B testing for email templates
- [ ] Email analytics dashboard
- [ ] Attachment scanning (virus detection)
- [ ] Email scheduling (send at specific time)

## Support

For issues or questions:
- Check logs: `lib/monitoring/logger`
- Review API documentation
- Contact development team

---

**Version:** 1.0.0
**Last Updated:** December 2025
