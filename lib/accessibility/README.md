# Acessibilidade - Guia de Uso

Este diretório contém hooks e utilitários para facilitar o desenvolvimento de interfaces acessíveis no ServiceDesk.

## Hooks Disponíveis

### `useAnnouncement()`

Anuncia mensagens para leitores de tela sem interromper o fluxo visual.

```tsx
import { useAnnouncement } from '@/lib/accessibility/hooks';

function TicketForm() {
  const announce = useAnnouncement();

  const handleSubmit = async () => {
    announce('Salvando ticket...', 'polite');

    try {
      await saveTicket();
      announce('Ticket salvo com sucesso!', 'polite');
    } catch (error) {
      announce('Erro ao salvar ticket', 'assertive');
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### `useFocusTrap()`

Mantém o foco dentro de um modal/dialog.

```tsx
import { useFocusTrap } from '@/lib/accessibility/hooks';

function Modal({ isOpen, onClose }) {
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen);

  if (!isOpen) return null;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true">
      <h2>Título do Modal</h2>
      <button onClick={onClose}>Fechar</button>
    </div>
  );
}
```

### `useKeyboardShortcut()`

Adiciona atalhos de teclado acessíveis.

```tsx
import { useKeyboardShortcut } from '@/lib/accessibility/hooks';

function App() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Ctrl+K ou Cmd+K para abrir paleta de comandos
  useKeyboardShortcut({ key: 'k', ctrlKey: true }, () => {
    setCommandPaletteOpen(true);
  });

  return <CommandPalette isOpen={commandPaletteOpen} />;
}
```

### `usePrefersReducedMotion()`

Detecta preferência do usuário por movimento reduzido.

```tsx
import { usePrefersReducedMotion } from '@/lib/accessibility/hooks';

function AnimatedCard() {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={cn(
        'card',
        !prefersReducedMotion && 'animate-slide-in'
      )}
    >
      Conteúdo
    </div>
  );
}
```

### `useId()`

Gera IDs únicos para acessibilidade.

```tsx
import { useId } from '@/lib/accessibility/hooks';

function FormField({ label }) {
  const id = useId('field');

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={`${id}-description`} />
      <p id={`${id}-description`}>Campo obrigatório</p>
    </div>
  );
}
```

### `useLoadingState()`

Gerencia estado de loading com anúncios automáticos.

```tsx
import { useLoadingState } from '@/lib/accessibility/hooks';

function DataTable() {
  const { isLoading, startLoading, stopLoading } = useLoadingState();

  const loadData = async () => {
    startLoading('Carregando dados...');

    try {
      const data = await fetchData();
      stopLoading('Dados carregados com sucesso');
    } catch (error) {
      stopLoading('Erro ao carregar dados');
    }
  };

  return (
    <div>
      {isLoading ? <Spinner /> : <Table />}
    </div>
  );
}
```

## Utilitários Disponíveis

### Contraste de Cores

```tsx
import { getContrastRatio, meetsContrastStandards } from '@/lib/accessibility/utils';

// Verificar contraste
const ratio = getContrastRatio('#ffffff', '#000000');
console.log(ratio); // 21:1

// Verificar conformidade WCAG
const isAccessible = meetsContrastStandards('#333333', '#ffffff', {
  level: 'AA',
  largeText: false
});
console.log(isAccessible); // true
```

### Anúncios Imperativo

```tsx
import { announce } from '@/lib/accessibility/utils';

// Usar fora de componentes React
function deleteTicket(id: number) {
  announce(`Ticket ${id} excluído com sucesso`, 'polite');
}
```

### Props Helpers

```tsx
import {
  getDialogProps,
  getCloseButtonProps,
  getFormFieldProps
} from '@/lib/accessibility/utils';

function MyModal() {
  return (
    <div {...getDialogProps('modal-title', 'modal-desc')}>
      <h2 id="modal-title">Título</h2>
      <p id="modal-desc">Descrição</p>
      <button {...getCloseButtonProps('modal')}>×</button>
    </div>
  );
}

function MyForm() {
  const [error, setError] = useState(false);

  return (
    <div>
      <label htmlFor="email">Email</label>
      <input
        {...getFormFieldProps('email', {
          required: true,
          invalid: error,
          describedBy: error ? 'email-error' : undefined
        })}
      />
      {error && (
        <p id="email-error" role="alert">
          Email inválido
        </p>
      )}
    </div>
  );
}
```

### Validação de Acessibilidade

```tsx
import {
  validateHeadingStructure,
  validateLandmarks,
  runAccessibilityValidation
} from '@/lib/accessibility/utils';

// Em desenvolvimento, verificar acessibilidade
if (process.env.NODE_ENV === 'development') {
  const { valid, warnings, errors } = runAccessibilityValidation();

  if (!valid) {
    console.warn('Avisos de acessibilidade:', warnings);
    console.error('Erros de acessibilidade:', errors);
  }
}
```

## Padrões Comuns

### Botão de Fechar Modal

```tsx
<button
  type="button"
  onClick={onClose}
  aria-label="Fechar modal de confirmação"
>
  <span className="sr-only">Fechar</span>
  <XIcon className="h-5 w-5" aria-hidden="true" />
</button>
```

### Live Region para Notificações

```tsx
<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Form com Validação

```tsx
<div>
  <label htmlFor="password" className="block mb-2">
    Senha <span aria-label="obrigatório">*</span>
  </label>
  <input
    id="password"
    type="password"
    required
    aria-required="true"
    aria-invalid={hasError}
    aria-describedby={hasError ? 'password-error' : undefined}
  />
  {hasError && (
    <p id="password-error" role="alert" className="text-red-600">
      A senha deve ter no mínimo 8 caracteres
    </p>
  )}
</div>
```

### Menu Dropdown

```tsx
<div>
  <button
    onClick={() => setOpen(!open)}
    aria-expanded={open}
    aria-haspopup="true"
    aria-controls="user-menu"
    aria-label="Menu do usuário"
  >
    <UserIcon aria-hidden="true" />
  </button>

  {open && (
    <div
      id="user-menu"
      role="menu"
      aria-label="Opções do usuário"
    >
      <button role="menuitem" onClick={handleProfile}>
        <UserIcon aria-hidden="true" />
        Perfil
      </button>
      <button role="menuitem" onClick={handleLogout}>
        <LogoutIcon aria-hidden="true" />
        Sair
      </button>
    </div>
  )}
</div>
```

### Loading com Anúncio

```tsx
const [loading, setLoading] = useState(false);
const announce = useAnnouncement();

const handleSave = async () => {
  setLoading(true);
  announce('Salvando alterações...', 'polite');

  try {
    await save();
    announce('Alterações salvas com sucesso', 'polite');
  } catch (error) {
    announce('Erro ao salvar alterações', 'assertive');
  } finally {
    setLoading(false);
  }
};

return (
  <button
    onClick={handleSave}
    disabled={loading}
    aria-busy={loading}
  >
    {loading ? 'Salvando...' : 'Salvar'}
  </button>
);
```

## Testes de Acessibilidade

### Com Playwright

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('should not have accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

### Testes Manuais

1. **Navegação por Teclado:**
   - Tab: próximo elemento
   - Shift+Tab: elemento anterior
   - Enter/Space: ativar elemento
   - Escape: fechar modal/menu

2. **Screen Reader:**
   - NVDA (Windows): Gratuito
   - VoiceOver (macOS): Cmd+F5
   - TalkBack (Android): Configurações > Acessibilidade

3. **Ferramentas DevTools:**
   - axe DevTools (extensão Chrome/Firefox)
   - Lighthouse (Chrome DevTools)
   - WAVE (extensão)

## Recursos

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM](https://webaim.org/)
- [Inclusive Components](https://inclusive-components.design/)

## Suporte

Para dúvidas sobre acessibilidade, consulte:
- [ACCESSIBILITY_REPORT.md](../../ACCESSIBILITY_REPORT.md)
- WCAG 2.1 Quick Reference
- Equipe de desenvolvimento
