# SPRINT 3: Quick Reference Card

## WhatsApp Integration

### Basic Usage
```typescript
import { getWhatsAppClient } from '@/lib/integrations/whatsapp/business-api';

const client = getWhatsAppClient();

// Send text message
await client.sendTextMessage('5511999999999', 'Hello!');

// Send template
await client.sendTemplateMessage('5511999999999', 'welcome_message', 'pt_BR');

// Upload and send media
const upload = await client.uploadMedia(fileBuffer, 'image/jpeg', 'photo.jpg');
await client.sendMedia('5511999999999', 'image', upload.mediaId!, 'Check this out');
```

### Environment Variables
```env
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxx
WHATSAPP_WEBHOOK_VERIFY_TOKEN=my_secret_token
```

---

## Gov.br OAuth

### Basic Usage
```typescript
import { getGovBrClient } from '@/lib/integrations/govbr/oauth-client';

const client = getGovBrClient();

// Generate auth URL
const authUrl = client.generateAuthorizationUrl(state, ['openid', 'email', 'cpf']);

// Exchange code for tokens
const result = await client.exchangeCodeForTokens(code);

// Get user profile
const profile = await client.getUserProfile(result.tokens!.access_token);

// Validate CPF
const isValid = client.validateCPF('123.456.789-00');

// Get trust level
const trust = client.getTrustLevel(profile.amr);
console.log(trust.level); // 'bronze', 'silver', or 'gold'
```

### Environment Variables
```env
GOVBR_CLIENT_ID=your_client_id
GOVBR_CLIENT_SECRET=your_client_secret
GOVBR_REDIRECT_URI=https://app.com/api/auth/govbr/callback
GOVBR_ENVIRONMENT=staging
```

---

## Email Automation

### Basic Usage
```typescript
import { emailAutomation } from '@/lib/integrations/email-automation';

// Send simple email
await emailAutomation.send({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome to our platform</h1>',
  priority: 'high'
});

// Send ticket notification
await emailAutomation.sendTicketNotification(123, 'created');

// Queue email
emailAutomation.queueEmail({
  to: 'user@example.com',
  subject: 'Queued message',
  body: 'Text version',
  html: '<p>HTML version</p>',
  priority: 'normal',
  scheduledFor: new Date(Date.now() + 3600000) // 1 hour later
});

// Start IMAP monitoring
await emailAutomation.startIMAPMonitoring();
```

### Custom Templates
```typescript
// Compile custom template
emailAutomation.compileTemplate(
  'my_template',
  'Hello {{name}}!',
  '<h1>Hello {{name}}!</h1><p>{{message}}</p>'
);

// Render template
const rendered = emailAutomation.renderTemplate('my_template', {
  name: 'John',
  message: 'Welcome aboard!'
});

// Send rendered template
await emailAutomation.send({
  to: 'user@example.com',
  subject: rendered.subject,
  html: rendered.body
});
```

### Environment Variables
```env
# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=app_password
SMTP_FROM=noreply@app.com

# IMAP (optional)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your_email@gmail.com
IMAP_PASS=app_password
```

---

## Integration Patterns

### Auto-Create Ticket from WhatsApp
```typescript
// In webhook handler
const result = await client.processIncomingMessage(message, profileName);
// Automatically creates ticket or adds comment
```

### Auto-Create Ticket from Email
```typescript
// Process incoming email
const result = await emailAutomation.processIncomingEmail(rawEmailBuffer);
// Extracts ticket ID or creates new ticket
```

### Send Multi-Channel Notification
```typescript
// Send notification via all channels
async function notifyUser(userId: number, ticketId: number, message: string) {
  const user = await getUserById(userId);
  
  // Email
  await emailAutomation.send({
    to: user.email,
    subject: `Ticket #${ticketId} Update`,
    html: message
  });
  
  // WhatsApp (if user has phone)
  if (user.phone) {
    const wa = getWhatsAppClient();
    await wa.sendTextMessage(user.phone, message);
  }
}
```

---

## Webhook Endpoints

### WhatsApp Webhook
- **URL:** `https://your-app.com/api/integrations/whatsapp/webhook`
- **Methods:** GET (verification), POST (messages)
- **Verify Token:** Set in Meta Business Suite

### Gov.br Callback
- **URL:** `https://your-app.com/api/auth/govbr/callback`
- **Method:** GET
- **Parameters:** code, state

---

## Common Patterns

### Session Management (WhatsApp)
```typescript
const client = getWhatsAppClient();

// Create session
client.createSession('5511999999999', userId, ticketId);

// Get session
const session = client.getSession('5511999999999');

// Update session
client.updateSession('5511999999999', { ticketId: 456 });

// Close session
client.closeSession('5511999999999');
```

### CPF/CNPJ Validation
```typescript
const client = getGovBrClient();

// Validate and format CPF
const cpf = '12345678900';
if (client.validateCPF(cpf)) {
  const formatted = client.formatCPF(cpf); // 123.456.789-00
}

// Validate and format CNPJ
const cnpj = '12345678000190';
if (client.validateCNPJ(cnpj)) {
  const formatted = client.formatCNPJ(cnpj); // 12.345.678/0001-90
}
```

### Email Queue Priority
```typescript
// High priority - sent first
emailAutomation.queueEmail({
  to: 'urgent@example.com',
  subject: 'URGENT',
  body: 'Critical issue',
  html: '<h1>Critical</h1>',
  priority: 'high'
});

// Normal priority
emailAutomation.queueEmail({
  to: 'user@example.com',
  subject: 'Update',
  body: 'Regular update',
  html: '<p>Update</p>',
  priority: 'normal'
});

// Low priority - sent last
emailAutomation.queueEmail({
  to: 'newsletter@example.com',
  subject: 'Newsletter',
  body: 'Monthly newsletter',
  html: '<p>Newsletter</p>',
  priority: 'low'
});
```

---

## Error Handling

### WhatsApp
```typescript
const result = await client.sendTextMessage(phone, message);
if (!result.success) {
  console.error('Failed to send WhatsApp:', result.error);
}
```

### Gov.br
```typescript
const tokenResult = await client.exchangeCodeForTokens(code);
if (!tokenResult.success) {
  console.error('Token exchange failed:', tokenResult.error);
}
```

### Email
```typescript
const result = await emailAutomation.send({...});
if (!result.success) {
  console.error('Email failed:', result.error);
}
```

---

## Tips & Best Practices

1. **WhatsApp:**
   - Use templates for first contact (24h window)
   - Clean up sessions periodically
   - Always mark messages as read
   - Handle all message types

2. **Gov.br:**
   - Store tokens securely
   - Implement token refresh
   - Respect trust levels
   - Validate CPF/CNPJ before storage

3. **Email:**
   - Use queue for bulk sending
   - Implement rate limiting
   - Monitor IMAP connection
   - Cache compiled templates

---

**Last Updated:** 2025-10-05
