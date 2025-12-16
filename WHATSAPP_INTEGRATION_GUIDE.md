# WhatsApp Business API Integration Guide

## Overview

The ServiceDesk WhatsApp Business API integration enables users to create and manage support tickets directly through WhatsApp. This integration provides:

- **Automatic ticket creation** from WhatsApp messages
- **Bi-directional communication** (users can send messages, agents can reply)
- **Media attachment support** (images, documents, audio, video)
- **Message templates** for automated responses
- **Multi-language support**
- **Conversation threading**
- **Status updates** sent via WhatsApp

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      WhatsApp Cloud API                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ├─ Webhooks (Incoming)
                          │
                ┌─────────▼──────────┐
                │  Webhook Handler   │
                │   (route.ts)       │
                └─────────┬──────────┘
                          │
                ┌─────────▼──────────┐
                │ Message Handler    │
                │ - Parse messages   │
                │ - Create tickets   │
                │ - Handle media     │
                └─────────┬──────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐     ┌──────▼──────┐   ┌─────▼─────┐
   │Database │     │   Storage   │   │Templates  │
   │ Tickets │     │  WhatsApp   │   │  System   │
   │Comments │     │  Messages   │   │           │
   └─────────┘     └─────────────┘   └───────────┘
                          │
                ┌─────────▼──────────┐
                │ Business API Client│
                │ - Send messages    │
                │ - Upload media     │
                │ - Rate limiting    │
                └─────────┬──────────┘
                          │
                          ├─ API Calls (Outgoing)
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    WhatsApp Cloud API                            │
└──────────────────────────────────────────────────────────────────┘
```

### Key Files

```
lib/integrations/whatsapp/
├── business-api.ts           # WhatsApp Cloud API client
├── client.ts                 # Alternative client implementation
├── message-handler.ts        # Message processing and ticket creation
├── templates.ts              # Template management system
├── storage.ts                # Database operations
└── webhook-handler.ts        # Webhook processing helpers

app/api/integrations/whatsapp/
├── webhook/route.ts          # Webhook endpoint (receives messages)
├── send/route.ts             # Send messages endpoint
├── messages/route.ts         # Message history endpoint
├── contacts/route.ts         # Contact management
├── templates/route.ts        # Template CRUD operations
├── templates/register/       # Bulk template registration
├── stats/route.ts            # Statistics endpoint
└── test/route.ts             # Connection testing

src/components/integrations/
└── WhatsAppConfig.tsx        # Admin configuration UI
```

## Setup Guide

### Prerequisites

1. **WhatsApp Business Account**
   - Sign up at [business.facebook.com](https://business.facebook.com)
   - Create a WhatsApp Business App
   - Get access to WhatsApp Cloud API

2. **Required Credentials**
   - Phone Number ID
   - Business Account ID
   - Access Token (permanent)
   - Webhook Verify Token (you define this)

### Step 1: Configure Environment Variables

Add the following to your `.env` file:

```bash
# WhatsApp Business API Configuration
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxx
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_WEBHOOK_VERIFY_TOKEN=my_secure_token_123
WHATSAPP_API_VERSION=v18.0

# Optional: Upload directory for media
UPLOAD_DIR=./uploads/whatsapp
```

### Step 2: Configure Webhook in Facebook

1. Go to WhatsApp Business Platform > Configuration
2. Set Webhook URL:
   ```
   https://your-domain.com/api/integrations/whatsapp/webhook
   ```
3. Set Verify Token: Use the same value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Subscribe to webhook fields:
   - `messages` ✓
   - `message_status` ✓

### Step 3: Configure in Admin Panel

1. Navigate to **Admin > Integrations > WhatsApp**
2. Enter your credentials
3. Click **Test Connection** to verify
4. Click **Save Configuration**

### Step 4: Register Message Templates

Templates must be approved by WhatsApp before use.

#### Option 1: Register Predefined Templates (Recommended)

Click **Register Default Templates** in the admin panel. This will register:

- `ticket_created` - New ticket confirmation
- `ticket_updated` - Ticket status updates
- `ticket_assigned` - Agent assignment notification
- `ticket_resolved` - Resolution notification
- `agent_response` - Agent reply notifications
- `sla_warning` - SLA deadline warnings

#### Option 2: Register Custom Templates

Use the API endpoint:

```bash
POST /api/integrations/whatsapp/templates
Content-Type: application/json

{
  "name": "custom_template",
  "category": "TRANSACTIONAL",
  "language": "pt_BR",
  "components": [
    {
      "type": "BODY",
      "text": "Olá {{1}}! Seu chamado {{2}} foi atualizado."
    }
  ]
}
```

## Usage

### Automatic Ticket Creation

When a user sends a message to your WhatsApp number:

1. Message is received via webhook
2. System checks for existing session
3. If no session exists, creates new ticket
4. Sends confirmation to user
5. Stores message in database

**Example Flow:**

```
User: "Meu computador não está ligando"
  ↓
System creates ticket #1234
  ↓
Bot: "✅ Chamado #1234 criado com sucesso!
      Recebemos sua solicitação e nossa equipe
      responderá em breve."
```

### Conversation Threading

Subsequent messages from the same user are added as comments to the existing ticket:

```
User: "Já tentei reiniciar mas não funcionou"
  ↓
System adds comment to ticket #1234
  ↓
Session remains active for 24 hours
```

### Commands

Users can use commands to interact with the system:

- `/ajuda` - Show available commands
- `/status` - Check ticket status
- `/novo` - Start new ticket
- `/cancelar` - Cancel current conversation

### Media Attachments

Supported media types:
- **Images**: JPG, PNG, GIF, WebP
- **Documents**: PDF, DOC, DOCX, XLS, XLSX
- **Audio**: MP3, OGG
- **Video**: MP4, MOV

Media is automatically:
1. Downloaded from WhatsApp
2. Saved to local storage
3. Attached to ticket
4. Available in ticket view

### Sending Messages from ServiceDesk

#### Via API

```bash
POST /api/integrations/whatsapp/send
Content-Type: application/json

{
  "to": "5511999999999",
  "type": "text",
  "content": {
    "text": "Olá! Seu chamado foi atualizado."
  },
  "ticketId": 1234
}
```

#### Via Template

```bash
POST /api/integrations/whatsapp/send
Content-Type: application/json

{
  "to": "5511999999999",
  "type": "template",
  "content": {
    "templateName": "ticket_created",
    "languageCode": "pt_BR",
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "João" },
          { "type": "text", "text": "1234" }
        ]
      }
    ]
  }
}
```

## Database Schema

### whatsapp_contacts
```sql
CREATE TABLE whatsapp_contacts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  phone_number TEXT UNIQUE NOT NULL,
  display_name TEXT,
  profile_picture_url TEXT,
  is_business BOOLEAN,
  is_verified BOOLEAN,
  last_seen DATETIME,
  status_message TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

### whatsapp_messages
```sql
CREATE TABLE whatsapp_messages (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL,
  ticket_id INTEGER,
  message_id TEXT UNIQUE NOT NULL,
  direction TEXT CHECK(direction IN ('inbound', 'outbound')),
  message_type TEXT,
  content TEXT,
  media_url TEXT,
  media_mime_type TEXT,
  media_caption TEXT,
  status TEXT,
  timestamp DATETIME,
  created_at DATETIME
);
```

### whatsapp_sessions
```sql
CREATE TABLE whatsapp_sessions (
  id INTEGER PRIMARY KEY,
  phone_number TEXT UNIQUE NOT NULL,
  session_data TEXT,
  last_activity DATETIME,
  is_active BOOLEAN,
  created_at DATETIME,
  updated_at DATETIME
);
```

### whatsapp_templates
```sql
CREATE TABLE whatsapp_templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  language TEXT NOT NULL,
  status TEXT DEFAULT 'PENDING',
  components TEXT NOT NULL,
  variables TEXT,
  metadata TEXT,
  created_at DATETIME,
  updated_at DATETIME,
  UNIQUE(name, language)
);
```

## API Reference

### Webhook Endpoint

**GET/POST** `/api/integrations/whatsapp/webhook`

Receives incoming messages and status updates from WhatsApp.

**Webhook Verification (GET)**
```
GET /api/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
```

**Message Webhook (POST)**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5511999999999",
          "id": "wamid.xxx",
          "timestamp": "1234567890",
          "type": "text",
          "text": {
            "body": "Hello"
          }
        }]
      }
    }]
  }]
}
```

### Send Message

**POST** `/api/integrations/whatsapp/send`

Send a message via WhatsApp.

**Request:**
```json
{
  "to": "5511999999999",
  "type": "text",
  "content": {
    "text": "Your message here"
  },
  "ticketId": 1234
}
```

**Response:**
```json
{
  "success": true,
  "messageId": "wamid.xxx"
}
```

### Templates

**GET** `/api/integrations/whatsapp/templates`

List all templates.

**Query Parameters:**
- `status` - Filter by status (PENDING, APPROVED, REJECTED)
- `category` - Filter by category
- `language` - Filter by language

**POST** `/api/integrations/whatsapp/templates`

Register a new template.

**Request:**
```json
{
  "name": "template_name",
  "category": "TRANSACTIONAL",
  "language": "pt_BR",
  "components": [...]
}
```

### Statistics

**GET** `/api/integrations/whatsapp/stats?days=30`

Get WhatsApp integration statistics.

**Response:**
```json
{
  "stats": {
    "totalMessages": 1234,
    "inboundMessages": 800,
    "outboundMessages": 434,
    "uniqueContacts": 250,
    "ticketsCreated": 180,
    "avgResponseTime": 15
  }
}
```

## Best Practices

### Rate Limiting

WhatsApp enforces rate limits:
- **1,000 messages per hour** (default tier)
- Higher tiers available based on quality rating

The API client automatically handles rate limiting.

### Message Templates

1. **Always use approved templates** for proactive messaging
2. **Test templates** before registering
3. **Keep templates generic** for reusability
4. **Use variables** for personalization

### Session Management

- Sessions expire after **24 hours** of inactivity
- Use `/novo` command to start fresh conversations
- Clean up expired sessions regularly

### Error Handling

Always handle errors gracefully:
```typescript
try {
  await sendMessage(...)
} catch (error) {
  logger.error('WhatsApp send failed', { error });
  // Fallback to email or internal notification
}
```

### Security

1. **Validate webhook signature** (optional but recommended)
2. **Secure credentials** in environment variables
3. **Rate limit** webhook endpoints
4. **Sanitize user input** before processing

## Monitoring

### Metrics to Track

- Message delivery rate
- Response time (user to agent)
- Template approval rate
- Error rate
- Active sessions
- Tickets created via WhatsApp

### Logs

All operations are logged with structured logging:

```typescript
logger.info('WhatsApp message received', {
  from: phoneNumber,
  type: messageType,
  ticketId: ticket?.id
});
```

### Health Checks

Use the test endpoint to verify connectivity:

```bash
POST /api/integrations/whatsapp/test
```

## Troubleshooting

### Webhook Not Receiving Messages

1. Verify webhook URL is publicly accessible
2. Check webhook subscription in Facebook console
3. Ensure verify token matches
4. Check server logs for errors

### Messages Not Sending

1. Verify access token is valid
2. Check phone number ID
3. Ensure templates are approved (for template messages)
4. Check rate limiting

### Templates Not Approved

1. Review WhatsApp template guidelines
2. Avoid promotional language for transactional templates
3. Use clear, concise text
4. Include opt-out language for marketing

### Media Upload Failures

1. Check upload directory permissions
2. Verify disk space
3. Ensure supported file types
4. Check file size limits (WhatsApp has limits)

## Migration & Scaling

### PostgreSQL Migration

The schema is PostgreSQL-compatible. For migration:

1. Update DATABASE_URL to PostgreSQL
2. Run migrations
3. Update queries if needed

### Horizontal Scaling

For high-volume deployments:

1. Use **Redis** for session storage
2. Deploy multiple webhook instances behind load balancer
3. Use **message queue** for processing
4. Implement **circuit breakers** for API calls

## Support

For issues or questions:

1. Check logs in `/var/log/servicedesk/whatsapp.log`
2. Review WhatsApp Business API documentation
3. Contact WhatsApp Business support
4. Open issue in repository

## Resources

- [WhatsApp Business Platform Documentation](https://developers.facebook.com/docs/whatsapp)
- [WhatsApp Cloud API Reference](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Message Templates Guide](https://developers.facebook.com/docs/whatsapp/message-templates)
- [Webhook Setup Guide](https://developers.facebook.com/docs/graph-api/webhooks)

## License

This integration is part of ServiceDesk and follows the same license.
