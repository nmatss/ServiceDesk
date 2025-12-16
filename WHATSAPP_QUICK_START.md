# WhatsApp Integration - Quick Start Guide

## 5-Minute Setup

### Step 1: Get WhatsApp Credentials (5 minutes)

1. Go to [Facebook Business](https://business.facebook.com)
2. Create or select your WhatsApp Business App
3. Navigate to **WhatsApp > API Setup**
4. Copy these values:
   - **Phone Number ID**
   - **WhatsApp Business Account ID**
   - **Access Token** (generate a permanent one)

### Step 2: Configure Environment Variables (1 minute)

Add to your `.env` file:

```bash
WHATSAPP_PHONE_NUMBER_ID=123456789012345
WHATSAPP_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxx
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789012345
WHATSAPP_WEBHOOK_VERIFY_TOKEN=$(openssl rand -hex 32)
WHATSAPP_API_VERSION=v18.0
```

### Step 3: Configure Webhook (2 minutes)

1. In Facebook Business > WhatsApp > Configuration
2. Click **Edit** on Webhook
3. Set Callback URL:
   ```
   https://your-domain.com/api/integrations/whatsapp/webhook
   ```
4. Set Verify Token: (same as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` above)
5. Subscribe to fields:
   - ✓ messages
   - ✓ message_status

### Step 4: Test Connection (30 seconds)

1. Navigate to **Admin > Integrations > WhatsApp**
2. Click **Test Connection**
3. If green ✓, you're ready!

### Step 5: Register Templates (2 minutes)

1. In WhatsApp Config page
2. Click **Register Default Templates**
3. Wait 24-48 hours for WhatsApp approval

## That's It!

Users can now message your WhatsApp number and automatically create tickets.

## Test the Integration

Send a WhatsApp message to your business number:

```
"Olá, preciso de ajuda com meu pedido"
```

You should receive:

```
✅ Chamado #1234 criado com sucesso!
Recebemos sua solicitação e nossa equipe responderá em breve.
```

## Available Commands

Users can use these commands:

- `/ajuda` - Show help
- `/status` - Check ticket status
- `/novo` - Create new ticket
- `/cancelar` - Cancel conversation

## Next Steps

- Send replies from ServiceDesk UI (coming soon)
- Monitor statistics in Admin > WhatsApp
- Customize templates for your needs
- Set up automated responses

## Troubleshooting

### Webhook Not Working?

```bash
# Test webhook endpoint
curl https://your-domain.com/api/integrations/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test
```

Should return: `test`

### Templates Not Approved?

- Check WhatsApp Business Manager > Message Templates
- Review rejection reasons
- Avoid promotional language
- Keep templates generic

### Messages Not Sending?

1. Check credentials in .env
2. Verify access token is valid
3. Check rate limits
4. Review logs

## Support

For detailed documentation, see [WHATSAPP_INTEGRATION_GUIDE.md](./WHATSAPP_INTEGRATION_GUIDE.md)
