# Email Automation - Quick Start Guide

Get the email automation system up and running in 5 minutes!

## Step 1: Install Dependencies (Already Done ✅)

The required packages are already installed:
- `imapflow` - IMAP client
- `mailparser` - Email parsing
- `nodemailer` - Email sending (already in package.json)
- `handlebars` - Templates (already in package.json)

## Step 2: Configure Environment Variables

Add these to your `.env` file:

```bash
# SMTP Configuration (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Email Settings
EMAIL_FROM_NAME=ServiceDesk
EMAIL_FROM_ADDRESS=noreply@servicedesk.com
EMAIL_RATE_LIMIT=100

# Application URL
APP_URL=http://localhost:3000
SUPPORT_EMAIL=support@yourdomain.com

# Webhook Secret (generate a random string)
EMAIL_WEBHOOK_SECRET=your-secret-key-here
```

### Getting Gmail App Password

1. Go to Google Account Settings
2. Security → 2-Step Verification
3. App passwords
4. Generate new app password
5. Copy the 16-character password

## Step 3: Run Database Migration

```bash
# Option 1: Using SQLite directly
sqlite3 servicedesk.db < lib/db/migrations/010_email_integration.sql

# Option 2: Using npm script (if configured)
npm run init-db
```

This creates:
- 6 new tables
- 15+ indexes
- Default email templates
- Sample automation rules

## Step 4: Test Email Sending

### Option A: Using the UI (Recommended)

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Navigate to: `http://localhost:3000/admin/integrations/email`

3. Configure SMTP settings

4. Click "Test Connection"

5. Send a test email

### Option B: Using Code

Create a file `test-email.ts`:

```typescript
import { emailSender } from './lib/integrations/email/sender';

async function test() {
  // Test connection
  const isConnected = await emailSender.verifyConnection();
  console.log('SMTP Connected:', isConnected);

  // Send test email
  const result = await emailSender.send({
    to: 'your-email@example.com',
    subject: 'Test Email from ServiceDesk',
    html: '<h1>Success!</h1><p>Email system is working!</p>',
    text: 'Success! Email system is working!',
  });

  console.log('Email sent:', result);
}

test();
```

Run it:
```bash
npx tsx test-email.ts
```

## Step 5: Send Your First Template Email

```typescript
import { emailSender } from './lib/integrations/email/sender';

await emailSender.queueTemplate(
  'ticket_created',
  'customer@example.com',
  {
    ticketNumber: 'TKT-000001',
    ticket: {
      id: 1,
      title: 'Test Ticket',
      description: 'This is a test',
      priority: 'Alta',
      status: 'Aberto',
      createdAt: new Date(),
    },
    customer: {
      name: 'Test User',
      email: 'customer@example.com',
    },
    tenant: {
      name: 'My Company',
      supportEmail: 'support@mycompany.com',
    },
  },
  1, // tenantId
  { priority: 'high' }
);

console.log('Email queued!');
```

## Step 6: Set Up Incoming Email (Optional)

### Option A: Webhook (Recommended)

1. Deploy your app to a public URL

2. Configure your email service to forward emails to:
   ```
   POST https://your-domain.com/api/integrations/email/webhook
   Authorization: Bearer YOUR_WEBHOOK_SECRET
   ```

3. Supported services:
   - SendGrid
   - Mailgun
   - Postmark
   - AWS SES
   - Any service with webhook support

### Option B: IMAP (Coming Soon)

Add IMAP configuration to `.env`:

```bash
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true
IMAP_USER=your-email@gmail.com
IMAP_PASS=your-app-password
```

## Common Tasks

### Send a Simple Email

```typescript
import { emailSender } from '@/lib/integrations/email/sender';

await emailSender.send({
  to: 'user@example.com',
  subject: 'Hello!',
  html: '<p>Hello from ServiceDesk!</p>',
  text: 'Hello from ServiceDesk!',
});
```

### Send Using Template

```typescript
await emailSender.queueTemplate(
  'ticket_updated',
  'customer@example.com',
  { /* template data */ },
  1
);
```

### Process Email Queue Manually

```typescript
import { emailSender } from '@/lib/integrations/email/sender';

await emailSender.processQueue(50); // Process up to 50 emails
```

### Get Email Statistics

```typescript
const stats = await emailSender.getStats(1); // tenantId
console.log(stats);
```

### Create Custom Template

```typescript
import { templateEngine } from '@/lib/integrations/email/templates';

await templateEngine.saveTemplate({
  name: 'My Template',
  code: 'my_template',
  subject: 'Hello {{name}}',
  bodyHtml: '<h1>Hello {{name}}</h1>',
  bodyText: 'Hello {{name}}',
  language: 'pt-BR',
  category: 'custom',
  variables: ['name'],
  isActive: true,
});
```

## Available Templates

The system comes with 5 built-in templates:

1. **ticket_created** - New ticket confirmation
2. **ticket_updated** - Ticket status update
3. **ticket_resolved** - Ticket resolution notification
4. **sla_warning** - SLA deadline warning
5. **new_comment** - New comment notification

## Template Variables

### All Templates
- `{{tenant.name}}` - Company name
- `{{tenant.supportEmail}}` - Support email

### Ticket Templates
- `{{ticketNumber}}` - Ticket number
- `{{ticket.title}}` - Ticket title
- `{{ticket.description}}` - Description
- `{{ticket.priority}}` - Priority
- `{{ticket.status}}` - Status
- `{{customer.name}}` - Customer name
- `{{customer.email}}` - Customer email

### Custom Helpers
- `{{formatDate date}}` - Format date
- `{{formatDateTime date}}` - Format date & time
- `{{uppercase text}}` - UPPERCASE
- `{{capitalize text}}` - Capitalize
- `{{currency value}}` - R$ 1.234,56
- `{{ticketUrl id}}` - Generate ticket URL
- `{{{priorityBadge priority}}}` - Priority badge (HTML)
- `{{{statusBadge status}}}` - Status badge (HTML)

## Troubleshooting

### Email not sending

1. Check SMTP credentials in `.env`
2. Verify connection: `await emailSender.verifyConnection()`
3. Check email queue: `await emailSender.getStats()`
4. Review server logs

### Template not found

1. List templates: `GET /api/integrations/email/templates`
2. Check template code matches
3. Verify template is active

### Incoming emails not working

1. Verify webhook URL is public
2. Check webhook secret matches
3. Test with manual POST request
4. Review webhook logs

## Next Steps

1. ✅ Configure SMTP
2. ✅ Test email sending
3. ✅ Send template email
4. ✅ Set up webhook (optional)
5. 📖 Read full guide: `EMAIL_AUTOMATION_GUIDE.md`
6. 💡 Check examples: `examples/email-automation-examples.ts`
7. 🎨 Customize templates via UI
8. 🔧 Create automation rules

## Resources

- **Full Documentation**: `EMAIL_AUTOMATION_GUIDE.md`
- **Implementation Summary**: `EMAIL_AUTOMATION_SUMMARY.md`
- **Code Examples**: `examples/email-automation-examples.ts`
- **API Routes**:
  - Webhook: `/api/integrations/email/webhook`
  - Send: `/api/integrations/email/send`
  - Templates: `/api/integrations/email/templates`

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review server logs
3. Check database for queued emails
4. Verify environment variables

---

**Quick Start Complete!** 🎉

You now have a fully functional email automation system.

For advanced features and customization, see the full documentation.
