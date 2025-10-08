# ARIA Quick Reference - Sistema de Notificações

## Guia Rápido para Desenvolvedores

### 1. Quando Usar role="alert"

Use para notificações urgentes que precisam ser anunciadas imediatamente:

```tsx
// ❌ Incorreto
<div className="notification error">
  Erro crítico!
</div>

// ✅ Correto
<div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  className="notification error"
>
  Erro crítico!
</div>
```

**Regra:** Use `aria-live="assertive"` apenas para erros críticos.

---

### 2. Quando Usar role="status"

Use para indicadores de estado que mudam frequentemente:

```tsx
// Status de conexão
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {isConnected ? 'Conectado' : 'Desconectado'}
</div>

// Contador de usuários
<div role="status" aria-label="5 usuários online">
  5 online
</div>
```

**Regra:** Use `aria-live="polite"` para não interromper a leitura.

---

### 3. Botões Acessíveis

Sempre adicione `aria-label` descritivo:

```tsx
// ❌ Incorreto
<button onClick={handleClose}>
  <XIcon />
</button>

// ✅ Correto
<button
  onClick={handleClose}
  aria-label={`Fechar notificação: ${notification.title}`}
>
  <XIcon aria-hidden="true" />
</button>
```

**Regra:** Ícones devem ter `aria-hidden="true"`, botões devem ter `aria-label`.

---

### 4. Listas Semânticas

Use `role="list"` e `role="listitem"`:

```tsx
// ❌ Incorreto
<div className="notifications">
  {notifications.map(n => (
    <div key={n.id}>{n.message}</div>
  ))}
</div>

// ✅ Correto
<div
  role="list"
  aria-labelledby="heading"
  aria-live="polite"
  aria-atomic="false"
>
  {notifications.map(n => (
    <div
      key={n.id}
      role="listitem"
      aria-label={`${n.title}: ${n.message}`}
    >
      {n.message}
    </div>
  ))}
</div>
```

**Regra:** `aria-atomic="false"` para listas (anuncia apenas novos itens).

---

### 5. Dropdowns Acessíveis

```tsx
<button
  onClick={() => setOpen(!open)}
  aria-label="Notificações: 3 não lidas"
  aria-expanded={open}
  aria-haspopup="true"
>
  <BellIcon aria-hidden="true" />
</button>

{open && (
  <div
    role="region"
    aria-label="Painel de notificações"
  >
    {/* conteúdo */}
  </div>
)}
```

**Regra:** Use `aria-expanded` e `aria-haspopup` em botões de dropdown.

---

### 6. aria-live Hierarchy

```
aria-live="off"        → Sem anúncios (padrão)
aria-live="polite"     → Aguarda pausa (info, avisos)
aria-live="assertive"  → Interrompe leitura (erros críticos)
```

**Escolha correta:**
- Erros do sistema: `assertive`
- Notificações de ticket: `polite`
- Atualizações de status: `polite`
- Elementos decorativos: sem aria-live

---

### 7. aria-atomic Behavior

```tsx
// aria-atomic="true" - Lê elemento completo
<div role="alert" aria-atomic="true">
  <h3>Erro</h3>
  <p>Falha na conexão</p>
  {/* Anuncia: "Erro. Falha na conexão" */}
</div>

// aria-atomic="false" - Lê apenas mudanças
<div role="list" aria-atomic="false">
  <div role="listitem">Item 1</div>
  <div role="listitem">Item 2</div>
  {/* Anuncia: "Item 2" (apenas o novo) */}
</div>
```

---

### 8. Grupos de Ações

```tsx
<div role="group" aria-label="Ações da notificação">
  <button aria-label="Ver ticket">Ver</button>
  <button aria-label="Marcar como lida">Marcar</button>
  <button aria-label="Remover">Remover</button>
</div>
```

---

### 9. Checklist de Acessibilidade

Antes de commitar código de notificações, verifique:

- [ ] Todos os botões têm `aria-label` descritivo
- [ ] Ícones têm `aria-hidden="true"`
- [ ] Notificações têm `role="alert"` ou `role="status"`
- [ ] Listas usam `role="list"` e `role="listitem"`
- [ ] Dropdowns têm `aria-expanded` e `aria-haspopup`
- [ ] Status de conexão tem `aria-live="polite"`
- [ ] Erros críticos usam `aria-live="assertive"`
- [ ] Regiões têm `aria-label` ou `aria-labelledby`
- [ ] Badges de contagem têm `aria-label`
- [ ] Estados vazios têm `role="status"`

---

### 10. Exemplos Práticos

#### Notificação Toast de Sucesso:
```tsx
<div
  role="alert"
  aria-live="polite"
  aria-atomic="true"
  aria-label="Ticket criado com sucesso"
>
  <CheckIcon aria-hidden="true" />
  <div>
    <h4>Sucesso</h4>
    <p>Ticket #123 criado</p>
  </div>
  <button aria-label="Fechar notificação de sucesso">
    <XIcon aria-hidden="true" />
  </button>
</div>
```

#### Notificação Toast de Erro:
```tsx
<div
  role="alert"
  aria-live="assertive"
  aria-atomic="true"
  aria-label="Erro ao salvar dados"
>
  <XCircleIcon aria-hidden="true" />
  <div>
    <h4>Erro</h4>
    <p>Falha ao salvar dados</p>
  </div>
  <button aria-label="Fechar notificação de erro">
    <XIcon aria-hidden="true" />
  </button>
</div>
```

#### Lista de Notificações no Dropdown:
```tsx
<div
  role="region"
  aria-label="Painel de notificações"
>
  <h3 id="notif-heading">Notificações</h3>

  <div
    role="list"
    aria-labelledby="notif-heading"
    aria-live="polite"
    aria-atomic="false"
  >
    {notifications.map(n => (
      <div
        key={n.id}
        role="listitem"
        aria-label={`${n.title}: ${n.message}. ${n.read ? 'Lida' : 'Não lida'}`}
      >
        {/* conteúdo */}
      </div>
    ))}
  </div>
</div>
```

#### Status de Usuários Online:
```tsx
<div
  role="region"
  aria-label="Usuários online"
>
  <button
    aria-expanded={expanded}
    aria-controls="users-list"
    aria-label={`${count} usuários online. Clique para ${expanded ? 'ocultar' : 'expandir'}`}
  >
    <UsersIcon aria-hidden="true" />
    {count} online
  </button>

  {expanded && (
    <div id="users-list" role="list">
      {users.map(u => (
        <div
          key={u.id}
          role="listitem"
          aria-label={`${u.name}, ${u.role}, ativo ${u.lastActivity}`}
        >
          {/* conteúdo */}
        </div>
      ))}
    </div>
  )}

  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    {connected ? 'Conectado' : 'Desconectado'}
  </div>
</div>
```

---

### 11. Erros Comuns a Evitar

❌ **Não fazer:**
```tsx
// Sem aria-label em botão com ícone
<button onClick={handleClick}>
  <TrashIcon />
</button>

// aria-live sem role apropriado
<div aria-live="polite">Mensagem</div>

// Ícone sem aria-hidden
<CheckIcon className="text-green-500" />

// Lista sem role="list"
<div className="notifications">
  {items.map(i => <div key={i.id}>{i.text}</div>)}
</div>
```

✅ **Fazer:**
```tsx
// Botão com aria-label descritivo
<button
  onClick={handleClick}
  aria-label="Remover notificação"
>
  <TrashIcon aria-hidden="true" />
</button>

// role + aria-live
<div role="alert" aria-live="polite">Mensagem</div>

// Ícone decorativo
<CheckIcon
  className="text-green-500"
  aria-hidden="true"
/>

// Lista semântica
<div role="list">
  {items.map(i => (
    <div
      key={i.id}
      role="listitem"
      aria-label={i.text}
    >
      {i.text}
    </div>
  ))}
</div>
```

---

### 12. Teste Rápido

Para testar acessibilidade rapidamente:

```bash
# 1. Navegue apenas com Tab/Enter
# - Todos os elementos interativos focáveis?
# - Ordem de foco lógica?

# 2. Ative leitor de tela
# macOS: Cmd + F5 (VoiceOver)
# Windows: NVDA (gratuito)

# 3. Interaja com notificações
# - Botão de sino anuncia contagem?
# - Novas notificações são anunciadas?
# - Botões têm descrições claras?
# - Status de conexão é anunciado?

# 4. Use DevTools
# - Instale axe DevTools
# - Execute análise automática
# - Corrija violações encontradas
```

---

### 13. Recursos Úteis

- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN ARIA Guide](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA)
- [WebAIM Articles](https://webaim.org/articles/)

---

**Dica Final:** Quando em dúvida, teste com um leitor de tela real. É a melhor forma de verificar se sua implementação está correta!
