# Guia de Configuração de Contatos

## 📋 Visão Geral

Este guia explica como configurar e personalizar as informações de contato exibidas no ServiceDesk Pro.

## 🎯 Configuração Rápida

### Passo 1: Defina as Variáveis de Ambiente

Copie o arquivo `.env.example` para `.env.local` e atualize:

```bash
cp .env.example .env.local
```

Edite `.env.local`:

```env
# Telefones
NEXT_PUBLIC_CONTACT_PHONE=+55 (11) 3040-5000
NEXT_PUBLIC_CONTACT_WHATSAPP=+55 (11) 97890-1234
NEXT_PUBLIC_CONTACT_SUPPORT_PHONE=+55 (11) 3040-5001
NEXT_PUBLIC_CONTACT_SALES_PHONE=+55 (11) 3040-5002

# Emails
NEXT_PUBLIC_CONTACT_EMAIL=contato@suaempresa.com.br
NEXT_PUBLIC_CONTACT_SUPPORT_EMAIL=suporte@suaempresa.com.br
NEXT_PUBLIC_CONTACT_SALES_EMAIL=vendas@suaempresa.com.br

# Endereço
NEXT_PUBLIC_CONTACT_ADDRESS_STREET=Sua Rua, 123 - Conj. 45
NEXT_PUBLIC_CONTACT_ADDRESS_CITY=São Paulo
NEXT_PUBLIC_CONTACT_ADDRESS_STATE=SP
NEXT_PUBLIC_CONTACT_ADDRESS_ZIP=01234-567

# Redes Sociais
NEXT_PUBLIC_SOCIAL_LINKEDIN=https://linkedin.com/company/sua-empresa
NEXT_PUBLIC_SOCIAL_TWITTER=https://twitter.com/suaempresa
NEXT_PUBLIC_SOCIAL_GITHUB=https://github.com/suaempresa

# Horários
NEXT_PUBLIC_HOURS_WEEKDAYS=Segunda a Sexta: 9h às 18h
```

### Passo 2: Reinicie o Servidor

```bash
npm run dev
```

As mudanças serão aplicadas automaticamente!

## 🧩 Usando o Componente ContactCard

### Importação

```tsx
import ContactCard from '@/components/ContactCard'
```

### Exemplos de Uso

#### 1. Card Simples (Minimal)

Ideal para footers e seções compactas:

```tsx
<ContactCard variant="minimal" />
```

**Resultado:**
```
📞 (11) 3040-5000  📧 suporte@servicedeskpro.com.br
```

---

#### 2. Card Padrão (Default)

Ideal para páginas de contato e portais:

```tsx
<ContactCard
  variant="default"
  contactType="support"
  showWhatsApp={true}
/>
```

**Resultado:**
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  📞         │  │  📧         │  │  💬         │
│  Telefone   │  │  E-mail     │  │  WhatsApp   │
│  (11) 3040  │  │  suporte@...│  │  (11) 9789  │
└─────────────┘  └─────────────┘  └─────────────┘
```

---

#### 3. Card Detalhado (Detailed)

Ideal para páginas dedicadas de contato:

```tsx
<ContactCard
  variant="detailed"
  contactType="sales"
  showAddress={true}
  showHours={true}
  showWhatsApp={true}
/>
```

**Resultado:**
```
┌────────────────────────────────────┐
│  Fale com Vendas                   │
├────────────────────────────────────┤
│  📞 Telefone                        │
│     +55 (11) 3040-5002             │
├────────────────────────────────────┤
│  📧 E-mail                          │
│     vendas@servicedeskpro.com.br   │
├────────────────────────────────────┤
│  💬 WhatsApp                        │
│     +55 (11) 97890-1234            │
├────────────────────────────────────┤
│  📍 Endereço                        │
│     Av. Paulista, 1234 - Conj. 567 │
│     São Paulo - SP, 01310-100      │
├────────────────────────────────────┤
│  🕒 Segunda a Sexta: 8h às 18h     │
│     Sábado: Fechado • Domingo: ... │
└────────────────────────────────────┘
```

## 🎨 Personalização Avançada

### Props Disponíveis

```typescript
interface ContactCardProps {
  // Estilo do card
  variant?: 'default' | 'minimal' | 'detailed'

  // Tipo de contato (define qual telefone/email usar)
  contactType?: 'support' | 'sales' | 'main'

  // Mostrar/ocultar elementos
  showWhatsApp?: boolean
  showAddress?: boolean
  showHours?: boolean

  // Classes CSS customizadas
  className?: string
}
```

### Exemplos de Customização

#### Card de Suporte Sem WhatsApp

```tsx
<ContactCard
  variant="default"
  contactType="support"
  showWhatsApp={false}
/>
```

#### Card de Vendas Completo

```tsx
<ContactCard
  variant="detailed"
  contactType="sales"
  showAddress={true}
  showHours={true}
  className="max-w-md mx-auto"
/>
```

#### Card Minimal Customizado

```tsx
<ContactCard
  variant="minimal"
  contactType="main"
  className="text-sm text-gray-500"
/>
```

## 🔧 API Reference

### contactInfo

Objeto global com todas as informações de contato:

```typescript
import { contactInfo } from '@/lib/config/contact'

// Acessar dados
contactInfo.phone.main         // "+55 (11) 3040-5000"
contactInfo.email.support      // "suporte@servicedeskpro.com.br"
contactInfo.social.linkedin    // "https://linkedin.com/..."
contactInfo.hours.weekdays     // "Segunda a Sexta: 8h às 18h"
```

### formattedContacts

Links formatados prontos para uso:

```typescript
import { formattedContacts } from '@/lib/config/contact'

// Links tel: (sem formatação)
formattedContacts.tel.main     // "5511304050000"

// Links mailto:
formattedContacts.mailto.support
// "mailto:suporte@servicedeskpro.com.br"

// Links WhatsApp (com mensagem)
formattedContacts.whatsapp.support
// "https://wa.me/5511978901234?text=Ol%C3%A1%2C%20preciso%20de%20suporte!"
```

### Funções Auxiliares

```typescript
import {
  formatPhoneForLink,
  formatPhoneForWhatsApp,
  getWhatsAppLink,
  getMailtoLink
} from '@/lib/config/contact'

// Remover formatação de telefone
formatPhoneForLink("+55 (11) 3040-5000")
// → "5511304050000"

// Criar link WhatsApp customizado
getWhatsAppLink("+55 (11) 9999-9999", "Olá, quero saber sobre...")
// → "https://wa.me/5511999999999?text=Ol%C3%A1..."

// Criar link mailto customizado
getMailtoLink(
  "contato@example.com",
  "Assunto",
  "Corpo do email"
)
// → "mailto:contato@example.com?subject=Assunto&body=Corpo..."
```

## 📱 Uso Manual em Componentes

Se você preferir não usar o componente `ContactCard`:

```tsx
import { contactInfo, formattedContacts } from '@/lib/config/contact'
import { PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline'

function MyCustomContact() {
  return (
    <div>
      {/* Telefone Clicável */}
      <a href={`tel:${formattedContacts.tel.support}`}>
        <PhoneIcon className="w-5 h-5" />
        {contactInfo.phone.support}
      </a>

      {/* Email Clicável */}
      <a href={formattedContacts.mailto.support}>
        <EnvelopeIcon className="w-5 h-5" />
        {contactInfo.email.support}
      </a>

      {/* WhatsApp */}
      <a
        href={formattedContacts.whatsapp.support}
        target="_blank"
        rel="noopener noreferrer"
      >
        💬 Falar no WhatsApp
      </a>
    </div>
  )
}
```

## 🌍 Internacionalização (i18n)

Para suportar múltiplos idiomas:

```typescript
// lib/config/contact.ts
export const getContactInfo = (locale: string = 'pt-BR') => {
  const hours = {
    'pt-BR': 'Segunda a Sexta: 8h às 18h',
    'en-US': 'Monday to Friday: 8am to 6pm',
    'es-ES': 'Lunes a Viernes: 8h a 18h'
  }

  return {
    // ... outros campos
    hours: {
      weekdays: hours[locale] || hours['pt-BR']
    }
  }
}
```

## ⚠️ Boas Práticas

### 1. Links em Mobile

Sempre use `tel:` para telefones:
```tsx
// ✅ Bom
<a href={`tel:${formattedContacts.tel.support}`}>Ligar</a>

// ❌ Ruim
<a href="#">{contactInfo.phone.support}</a>
```

### 2. WhatsApp em Nova Aba

Sempre abra WhatsApp em nova aba:
```tsx
// ✅ Bom
<a
  href={whatsappLink}
  target="_blank"
  rel="noopener noreferrer"
>

// ❌ Ruim
<a href={whatsappLink}>
```

### 3. Acessibilidade

Adicione aria-labels:
```tsx
// ✅ Bom
<a
  href={phoneLink}
  aria-label="Ligar para suporte"
>

// ❌ Ruim
<a href={phoneLink}>
  <PhoneIcon />
</a>
```

### 4. Validação de Email

Use validação antes de exibir:
```tsx
const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

{isValidEmail(contactInfo.email.support) && (
  <a href={formattedContacts.mailto.support}>
    {contactInfo.email.support}
  </a>
)}
```

## 🐛 Troubleshooting

### Problema: Links não funcionam

**Solução:** Verifique se as variáveis de ambiente têm o prefixo `NEXT_PUBLIC_`:

```env
# ✅ Correto
NEXT_PUBLIC_CONTACT_PHONE=+55 11 3040-5000

# ❌ Errado (não será exposto ao cliente)
CONTACT_PHONE=+55 11 3040-5000
```

### Problema: WhatsApp não abre com mensagem

**Solução:** Verifique a codificação da URL:

```typescript
// Use encodeURIComponent
const message = encodeURIComponent("Olá, preciso de ajuda!")
const link = `https://wa.me/5511999999999?text=${message}`
```

### Problema: Telefone não clicável no mobile

**Solução:** Use o formato correto (apenas números):

```typescript
// ✅ Correto
tel:5511304050000

// ❌ Errado
tel:+55 (11) 3040-5000
```

## 📚 Recursos Adicionais

- [WhatsApp Business API](https://business.whatsapp.com/)
- [RFC 3966 - tel URI](https://www.rfc-editor.org/rfc/rfc3966)
- [RFC 6068 - mailto URI](https://www.rfc-editor.org/rfc/rfc6068)
- [Heroicons Documentation](https://heroicons.com/)

---

**Última Atualização**: 2025-12-25
**Versão**: 1.0.0
