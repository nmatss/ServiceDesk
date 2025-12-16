# XSS Protection Guide

## Overview

This guide explains how to prevent Cross-Site Scripting (XSS) vulnerabilities in the ServiceDesk application using DOMPurify-based sanitization.

## Installation

DOMPurify is installed and configured in the project:

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

## Sanitization Functions

The application provides three levels of HTML sanitization located in `lib/security/sanitize.ts`:

### 1. `sanitizeHTML(dirty: string): string`

**Use for:** General HTML content with basic formatting needs.

**Allowed tags:**
- Text formatting: `b`, `i`, `em`, `strong`, `span`, `div`
- Structure: `p`, `br`, `h1-h6`, `blockquote`
- Lists: `ul`, `ol`, `li`
- Code: `code`, `pre`
- Links: `a` (with restricted attributes)

**Allowed attributes:** `href`, `target`, `rel`, `class`, `id`

**Example:**
```typescript
import { sanitizeHTML } from '@/lib/security/sanitize';

const userContent = '<p>Hello <strong>world</strong></p>';
const safeHTML = sanitizeHTML(userContent);
```

### 2. `sanitizeMarkdown(dirty: string): string`

**Use for:** Rich content from markdown rendering, knowledge base articles, documentation.

**Allowed tags:** All from `sanitizeHTML` plus:
- Tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`
- Media: `img`, `hr`

**Allowed attributes:** All from `sanitizeHTML` plus:
- Image attributes: `src`, `alt`, `title`, `width`, `height`

**Example:**
```typescript
import { sanitizeMarkdown } from '@/lib/security/sanitize';

const markdownHTML = '<h1>Title</h1><img src="/image.jpg" alt="Test">';
const safeHTML = sanitizeMarkdown(markdownHTML);
```

### 3. `sanitizeUserInput(dirty: string): string`

**Use for:** Direct user input with minimal formatting needs (comments, descriptions).

**Allowed tags:** `b`, `i`, `em`, `strong`, `p`, `br` only

**Allowed attributes:** None

**Example:**
```typescript
import { sanitizeUserInput } from '@/lib/security/sanitize';

const userComment = '<p>This is my comment</p>';
const safeHTML = sanitizeUserInput(userComment);
```

## Usage in React Components

### With dangerouslySetInnerHTML

**❌ WRONG - Vulnerable to XSS:**
```tsx
<div dangerouslySetInnerHTML={{ __html: userContent }} />
```

**✅ CORRECT - Protected:**
```tsx
import { sanitizeHTML } from '@/lib/security/sanitize';

<div dangerouslySetInnerHTML={{ __html: sanitizeHTML(userContent) }} />
```

### With Knowledge Base Articles

```tsx
import { sanitizeMarkdown } from '@/lib/security/sanitize';

<div
  className="prose prose-lg max-w-none"
  dangerouslySetInnerHTML={{ __html: sanitizeMarkdown(article.content) }}
/>
```

### With Search Results (Highlighted Text)

```tsx
import { sanitizeHTML } from '@/lib/security/sanitize';

const highlightedText = highlightMatches(result.title, matches);

<h3
  dangerouslySetInnerHTML={{
    __html: sanitizeHTML(highlightedText)
  }}
/>
```

## Server-Side Rendering (SSR) Considerations

The sanitization functions handle both client-side and server-side rendering:

- **Client-side:** Uses full DOMPurify sanitization
- **Server-side:** Uses basic regex-based script tag removal as a fallback

For production server-side use, consider using `isomorphic-dompurify` for full sanitization on the server.

## Protected Files

The following files have been updated with XSS protection:

### React Components
1. **`/app/knowledge/search/page.tsx`**
   - Sanitizes search result titles
   - Sanitizes search result summaries
   - Sanitizes highlighted match text

2. **`/app/knowledge/article/[slug]/page.tsx`**
   - Sanitizes article content using `sanitizeMarkdown`

### Utility Functions
3. **`/lib/pwa/performance-optimizer.ts`**
   - Sanitizes lazy-loaded HTML content
   - Critical fix: Content loaded via fetch is now sanitized before insertion

### Static Content (Safe - Developer Controlled)
4. **`/app/_document.tsx`**
   - Contains only static CSS and JavaScript (no user content)
   - No changes needed

5. **`/lib/pwa/mobile-utils.ts`**
   - Contains only static UI strings (no user content)
   - No changes needed

## Security Best Practices

### 1. Always Sanitize User Content

**Rule:** NEVER render user-generated content without sanitization.

```tsx
// User comments, ticket descriptions, knowledge base articles, etc.
<div dangerouslySetInnerHTML={{ __html: sanitizeHTML(userContent) }} />
```

### 2. Choose the Right Sanitization Level

- **User comments/input:** Use `sanitizeUserInput` (most restrictive)
- **General content:** Use `sanitizeHTML` (moderate)
- **Rich content/markdown:** Use `sanitizeMarkdown` (most permissive)

### 3. Avoid innerHTML in JavaScript

**❌ WRONG:**
```typescript
element.innerHTML = fetchedContent;
```

**✅ CORRECT:**
```typescript
import { sanitizeHTML } from '@/lib/security/sanitize';
element.innerHTML = sanitizeHTML(fetchedContent);
```

### 4. Content Security Policy (CSP)

The application uses CSP headers to provide defense-in-depth:

```typescript
// next.config.js
"Content-Security-Policy": "script-src 'self' 'unsafe-inline' 'unsafe-eval'..."
```

### 5. Regular Security Audits

Run security checks regularly:

```bash
# Find all dangerouslySetInnerHTML usage
grep -r "dangerouslySetInnerHTML" --include="*.tsx" --include="*.ts"

# Find all innerHTML usage
grep -r "\.innerHTML\s*=" --include="*.tsx" --include="*.ts"
```

## Testing

Unit tests are provided in `lib/security/__tests__/sanitize.test.ts`:

```bash
npm test lib/security/__tests__/sanitize.test.ts
```

Test coverage includes:
- Script tag removal
- Event handler removal
- Javascript protocol removal
- Data URI sanitization
- Server-side behavior
- Different sanitization levels

## Known Attack Vectors Prevented

1. **Script Injection:** `<script>alert('XSS')</script>` ❌ Blocked
2. **Event Handlers:** `<img onerror="alert('XSS')">` ❌ Blocked
3. **Javascript URLs:** `<a href="javascript:alert('XSS')">` ❌ Blocked
4. **Data URIs:** `<img src="data:text/html,<script>">` ❌ Blocked
5. **HTML Injection:** Arbitrary HTML tags ❌ Restricted to allowed list

## Migration Checklist

When adding new features that render user content:

- [ ] Import sanitization function
- [ ] Choose appropriate sanitization level
- [ ] Wrap content with sanitizer before rendering
- [ ] Test with malicious input
- [ ] Add unit tests
- [ ] Document the protection

## Additional Resources

- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Content Security Policy Guide](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## Support

For security concerns or questions, contact the security team or open a security advisory.
