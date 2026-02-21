# 🧪 GUIA DE TESTES - BUSCA COM AUTOCOMPLETE

**Agent 34 - Search Implementation**
**Data**: 2025-12-26

---

## 🚀 INICIANDO TESTES

### 1. Preparar Ambiente
```bash
# 1. Garantir que o banco de dados está inicializado
npm run init-db

# 2. Iniciar servidor de desenvolvimento
npm run dev

# 3. Acessar aplicação
# http://localhost:3000
```

### 2. Login na Aplicação
```
URL: http://localhost:3000/auth/login

# Usar credenciais do seed:
Admin:
  Email: admin@servicedesk.com
  Password: Admin123!

Agent:
  Email: agent@servicedesk.com
  Password: Agent123!

User:
  Email: user@servicedesk.com
  Password: User123!
```

---

## ✅ TESTES FUNCIONAIS

### TESTE 1: Busca Básica com Autocomplete
**Objetivo**: Verificar funcionamento básico do autocomplete

**Passos**:
1. Login como qualquer usuário
2. Localizar campo de busca no header (canto superior esquerdo)
3. Clicar no campo de busca
4. Digitar: `ticket`
5. Aguardar 300ms (debounce)

**Resultado Esperado**:
- ✅ Dropdown aparece abaixo do input
- ✅ Mostra loading indicator durante busca
- ✅ Exibe sugestões agrupadas por tipo
- ✅ Palavra "ticket" aparece destacada (fundo amarelo)
- ✅ Máximo de 10 sugestões
- ✅ Ícones corretos para cada tipo

**Screenshot**:
```
┌─────────────────────────────────────────┐
│ 🔍 [ticket____________] [X]             │
└─────────────────────────────────────────┘
   ┌─────────────────────────────────────┐
   │ TICKETS                             │
   │ 🎫 #123 - Login ticket              │
   │ 🎫 #456 - Printer ticket            │
   │                                     │
   │ BASE DE CONHECIMENTO                │
   │ 📖 How to create a ticket           │
   │                                     │
   │ [Ver todos os resultados]           │
   └─────────────────────────────────────┘
```

---

### TESTE 2: Keyboard Navigation
**Objetivo**: Verificar navegação por teclado

**Passos**:
1. Digitar: `problem`
2. Aguardar sugestões aparecerem
3. Pressionar `↓` (seta para baixo)
4. Pressionar `↓` novamente
5. Pressionar `↑` (seta para cima)
6. Pressionar `Enter`

**Resultado Esperado**:
- ✅ Primeiro `↓`: destaca primeira sugestão (fundo azul claro)
- ✅ Segundo `↓`: destaca segunda sugestão
- ✅ `↑`: volta para primeira sugestão
- ✅ `Enter`: navega para URL da sugestão selecionada
- ✅ Dropdown fecha após seleção
- ✅ Input é limpo

**Teclas Testadas**:
- `↓` - Próximo item
- `↑` - Item anterior
- `Enter` - Selecionar
- `Escape` - Fechar dropdown
- `Tab` - Navegar para fora

---

### TESTE 3: Click em Sugestão
**Objetivo**: Verificar seleção via mouse

**Passos**:
1. Digitar: `user`
2. Aguardar dropdown
3. Passar mouse sobre segunda sugestão
4. Clicar na sugestão

**Resultado Esperado**:
- ✅ Hover muda cor de fundo (cinza claro)
- ✅ Click navega para URL correta
- ✅ Dropdown fecha
- ✅ Input limpo
- ✅ Página de destino carrega corretamente

---

### TESTE 4: Busca Sem Resultados
**Objetivo**: Verificar estado vazio

**Passos**:
1. Digitar: `xyzabc123notfound`
2. Aguardar 300ms

**Resultado Esperado**:
- ✅ Dropdown aparece
- ✅ Mostra ícone de busca (lupa)
- ✅ Mensagem: "Nenhum resultado encontrado para 'xyzabc123notfound'"
- ✅ Não mostra loading infinito
- ✅ Não mostra erro

**Screenshot**:
```
┌─────────────────────────────────────────┐
│        🔍                               │
│                                         │
│  Nenhum resultado encontrado para       │
│  "xyzabc123notfound"                    │
│                                         │
│  [Ver todos os resultados]              │
└─────────────────────────────────────────┘
```

---

### TESTE 5: Limpeza de Busca
**Objetivo**: Verificar botão X (clear)

**Passos**:
1. Digitar: `test`
2. Aguardar sugestões
3. Clicar no botão `X` ao lado do input

**Resultado Esperado**:
- ✅ Input é limpo
- ✅ Dropdown fecha
- ✅ Focus permanece no input
- ✅ Pronto para nova busca

---

### TESTE 6: Click Fora do Dropdown
**Objetivo**: Verificar fechamento automático

**Passos**:
1. Digitar: `login`
2. Aguardar dropdown aparecer
3. Clicar em qualquer lugar fora do dropdown e do input

**Resultado Esperado**:
- ✅ Dropdown fecha
- ✅ Input mantém o texto digitado
- ✅ Nenhum erro no console

---

### TESTE 7: Debounce
**Objetivo**: Verificar otimização de requisições

**Passos**:
1. Abrir DevTools → Network tab
2. Filtrar por: `suggestions`
3. Digitar rapidamente: `p` `r` `o` `b` `l` `e` `m`
4. Observar requisições

**Resultado Esperado**:
- ✅ Apenas 1 requisição é feita
- ✅ Requisição ocorre 300ms após última tecla
- ✅ Requisições anteriores são canceladas (status: cancelled)

**Network Tab**:
```
suggestions?q=problem    200    150ms
suggestions?q=proble     cancelled
suggestions?q=probl      cancelled
suggestions?q=prob       cancelled
suggestions?q=pro        cancelled
suggestions?q=pr         cancelled
suggestions?q=p          cancelled
```

---

### TESTE 8: Cache de Resultados
**Objetivo**: Verificar cache funcionando

**Passos**:
1. DevTools → Network tab aberto
2. Digitar: `ticket`
3. Aguardar resultados
4. Anotar tempo da requisição
5. Limpar busca (X)
6. Digitar novamente: `ticket`
7. Observar Network tab

**Resultado Esperado**:
- ✅ Segunda busca NÃO faz nova requisição
- ✅ Resultados aparecem instantaneamente
- ✅ Cache é usado (sem nova network request)
- ✅ Resultados idênticos à primeira busca

**Tempo Esperado**:
- Primeira busca: ~100-200ms (com rede)
- Segunda busca: <10ms (cache)

---

### TESTE 9: Highlight de Termos
**Objetivo**: Verificar destaque visual

**Passos**:
1. Digitar: `login`
2. Observar sugestões

**Resultado Esperado**:
- ✅ Palavra "login" aparece com fundo amarelo
- ✅ Highlight funciona em title e subtitle
- ✅ Case-insensitive (LOGIN, login, Login todos destacados)
- ✅ Apenas termos exatos são destacados

**Exemplo Visual**:
```
Título: Problemas com [login] do sistema
                      ^^^^^
                    (amarelo)
```

---

### TESTE 10: Agrupamento por Tipo
**Objetivo**: Verificar organização de resultados

**Passos**:
1. Digitar termo que retorne múltiplos tipos: `system`
2. Observar estrutura do dropdown

**Resultado Esperado**:
- ✅ Seção "TICKETS" com header cinza
- ✅ Ícone 🎫 para tickets
- ✅ Seção "USUÁRIOS" (se admin)
- ✅ Ícone 👤 para usuários
- ✅ Seção "CATEGORIAS"
- ✅ Ícone 📁 para categorias
- ✅ Seção "BASE DE CONHECIMENTO"
- ✅ Ícone 📖 para artigos

**Estrutura**:
```
┌─────────────────────────────────────┐
│ TICKETS                        ▲    │
│ 🎫 System error #123           │    │
│ 🎫 System crash #456           │    │
├─────────────────────────────────────┤
│ CATEGORIAS                     │    │
│ 📁 Sistema                     │    │
├─────────────────────────────────────┤
│ BASE DE CONHECIMENTO           │    │
│ 📖 System architecture         ▼    │
└─────────────────────────────────────┘
```

---

### TESTE 11: Related Terms
**Objetivo**: Verificar sugestões relacionadas

**Passos**:
1. Digitar termo com poucos resultados: `xyz`
2. Observar rodapé do dropdown

**Resultado Esperado**:
- ✅ Seção "Buscas relacionadas:" aparece
- ✅ Mostra até 3 termos relacionados
- ✅ Termos clicáveis
- ✅ Click em termo preenche o input

**Exemplo**:
```
┌─────────────────────────────────────┐
│ (resultados...)                     │
├─────────────────────────────────────┤
│ Buscas relacionadas:                │
│ [help] [support] [issue]            │
└─────────────────────────────────────┘
```

---

### TESTE 12: Mobile Overlay
**Objetivo**: Verificar versão mobile

**Passos**:
1. Redimensionar janela para <640px OU usar DevTools mobile mode
2. Clicar no ícone de busca 🔍
3. Observar overlay

**Resultado Esperado**:
- ✅ Overlay fullscreen aparece
- ✅ Fundo escuro com blur
- ✅ Input tem auto-focus
- ✅ Botão X para fechar
- ✅ Autocomplete funciona igual desktop
- ✅ Touch-friendly (44px min touch target)

**Mobile Layout**:
```
┌─────────────────────────────────────┐
│ [🔍 Buscar...          ] [X]        │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ TICKETS                         │ │
│ │ 🎫 Ticket #123                  │ │
│ │ (touch-friendly height)         │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔐 TESTES DE SEGURANÇA

### TESTE 13: Role-Based Access (Admin)
**Objetivo**: Verificar visibilidade de usuários

**Passos**:
1. Login como **Admin**
2. Digitar nome de usuário: `João`

**Resultado Esperado**:
- ✅ Seção "USUÁRIOS" aparece
- ✅ Mostra usuários com nome João
- ✅ Subtitle mostra email e role
- ✅ Click leva para `/admin/users/{id}/edit`

---

### TESTE 14: Role-Based Access (User)
**Objetivo**: Verificar restrição de acesso

**Passos**:
1. Login como **User** (não admin)
2. Digitar nome de usuário: `João`

**Resultado Esperado**:
- ✅ Seção "USUÁRIOS" NÃO aparece
- ✅ Apenas tickets/categorias/KB são mostrados
- ✅ API não retorna dados de usuários

---

### TESTE 15: Autenticação Obrigatória
**Objetivo**: Verificar proteção da API

**Passos**:
1. Logout da aplicação
2. Tentar acessar diretamente:
   ```
   http://localhost:3000/api/search/suggestions?q=test
   ```

**Resultado Esperado**:
- ✅ Status 401 Unauthorized
- ✅ Mensagem: "Token de autenticação necessário"
- ✅ Nenhum dado é retornado

---

## ⚡ TESTES DE PERFORMANCE

### TESTE 16: Tempo de Resposta
**Objetivo**: Medir latência

**Passos**:
1. DevTools → Network → Throttling: Fast 3G
2. Digitar: `ticket`
3. Medir tempo de resposta

**Resultado Esperado**:
- ✅ Response time < 500ms (3G)
- ✅ Response time < 100ms (WiFi)
- ✅ Loading indicator visível
- ✅ Não trava a interface

---

### TESTE 17: Múltiplas Buscas Rápidas
**Objetivo**: Verificar estabilidade

**Passos**:
1. Digitar: `test` → limpar → `login` → limpar → `problem` → limpar
2. Repetir 10 vezes rapidamente
3. Observar console e performance

**Resultado Esperado**:
- ✅ Sem erros no console
- ✅ Sem memory leaks
- ✅ Cache funciona corretamente
- ✅ Requisições canceladas adequadamente
- ✅ Interface permanece responsiva

---

### TESTE 18: Limite de Resultados
**Objetivo**: Verificar paginação

**Passos**:
1. Digitar termo genérico: `e`
2. Contar sugestões no dropdown

**Resultado Esperado**:
- ✅ Máximo de 10 sugestões
- ✅ Botão "Ver todos os resultados"
- ✅ Scroll funciona se necessário
- ✅ Performance não degrada

---

## 🎨 TESTES DE UX/UI

### TESTE 19: Dark Mode
**Objetivo**: Verificar tema escuro

**Passos**:
1. Ativar dark mode (toggle no header)
2. Digitar: `test`
3. Observar dropdown

**Resultado Esperado**:
- ✅ Dropdown tem fundo escuro
- ✅ Texto tem contraste adequado
- ✅ Highlight amarelo permanece visível
- ✅ Hover state funciona
- ✅ Seleção (azul) visível

**Cores Dark Mode**:
- Background: `bg-neutral-800`
- Text: `text-neutral-100`
- Highlight: `bg-warning-900/30`
- Selected: `bg-brand-900/20`

---

### TESTE 20: Loading State
**Objetivo**: Verificar feedback visual

**Passos**:
1. DevTools → Network → Throttling: Slow 3G
2. Digitar: `slow`
3. Observar loading

**Resultado Esperado**:
- ✅ Spinner animado aparece no input
- ✅ Posicionado à direita do input
- ✅ Cor: brand-500
- ✅ Não bloqueia digitação
- ✅ Desaparece quando resultados chegam

---

### TESTE 21: Error State
**Objetivo**: Verificar tratamento de erros

**Passos**:
1. Desligar servidor (Ctrl+C no terminal)
2. Digitar: `test`
3. Aguardar timeout

**Resultado Esperado**:
- ✅ Mensagem de erro aparece
- ✅ Dropdown mostra erro em vermelho
- ✅ Não trava a interface
- ✅ Possível tentar novamente
- ✅ Console mostra erro detalhado

---

### TESTE 22: Responsividade
**Objetivo**: Verificar todos os breakpoints

**Passos**:
1. Testar em larguras: 320px, 768px, 1024px, 1920px
2. Observar layout do autocomplete

**Resultado Esperado**:

**Mobile (320px)**:
- ✅ Input: largura total
- ✅ Dropdown: largura total
- ✅ Ícone de busca visível
- ✅ Botão X acessível

**Tablet (768px)**:
- ✅ Input: `w-64` (256px)
- ✅ Dropdown alinhado
- ✅ Touch targets adequados

**Desktop (1024px+)**:
- ✅ Input: `w-80` (320px)
- ✅ Dropdown alinhado
- ✅ Hover states visíveis

---

### TESTE 23: Acessibilidade (ARIA)
**Objetivo**: Verificar screen reader support

**Passos**:
1. Inspecionar elemento do input
2. Verificar atributos ARIA

**Resultado Esperado**:
- ✅ `role="search"` no form
- ✅ `aria-label="Campo de busca global"`
- ✅ `aria-autocomplete="list"`
- ✅ `aria-controls="search-dropdown"`
- ✅ `aria-expanded="true/false"`
- ✅ `role="listbox"` no dropdown
- ✅ `role="option"` em cada item
- ✅ `aria-selected="true/false"` no item ativo

---

### TESTE 24: Focus Management
**Objetivo**: Verificar navegação por Tab

**Passos**:
1. Pressionar `Tab` até focar no input de busca
2. Digitar: `test`
3. Pressionar `Tab` novamente

**Resultado Esperado**:
- ✅ Input recebe focus visível (outline azul)
- ✅ Tab move focus para próximo elemento
- ✅ Dropdown permanece aberto se houver sugestões
- ✅ Shift+Tab volta para input

---

## 🐛 TESTES DE EDGE CASES

### TESTE 25: Caracteres Especiais
**Objetivo**: Verificar sanitização

**Passos**:
1. Digitar: `<script>alert('xss')</script>`
2. Observar resultados

**Resultado Esperado**:
- ✅ Nenhum script executado
- ✅ Caracteres < > são escapados
- ✅ Busca funciona normalmente
- ✅ Highlight funciona (se houver match)

---

### TESTE 26: Query Muito Longa
**Objetivo**: Verificar limite de input

**Passos**:
1. Digitar texto com 500+ caracteres
2. Observar comportamento

**Resultado Esperado**:
- ✅ Input não quebra layout
- ✅ Texto truncado visualmente (...)
- ✅ API processa normalmente
- ✅ Sem erros no console

---

### TESTE 27: Emojis e Unicode
**Objetivo**: Verificar suporte a caracteres especiais

**Passos**:
1. Digitar: `🎫 ticket 🔥`
2. Observar resultados

**Resultado Esperado**:
- ✅ Emojis renderizados corretamente
- ✅ Busca funciona
- ✅ Highlight funciona (ignora emojis)
- ✅ Sem caracteres quebrados

---

### TESTE 28: Latência Alta
**Objetivo**: Verificar timeout

**Passos**:
1. DevTools → Network → Throttling: Offline
2. Digitar: `test`
3. Voltar para Online após 5s

**Resultado Esperado**:
- ✅ Loading não trava
- ✅ Erro aparece após timeout
- ✅ Possível recuperar (tentar novamente)
- ✅ AbortController cancela requisição

---

### TESTE 29: Mínimo de Caracteres
**Objetivo**: Verificar validação

**Passos**:
1. Digitar: `a` (1 caractere)
2. Aguardar

**Resultado Esperado**:
- ✅ Dropdown NÃO aparece
- ✅ Nenhuma requisição é feita
- ✅ Placeholder visível

**Passos 2**:
1. Digitar: `ab` (2 caracteres)
2. Aguardar

**Resultado Esperado**:
- ✅ Dropdown aparece
- ✅ Requisição é feita
- ✅ Busca funciona normalmente

---

### TESTE 30: Scroll no Dropdown
**Objetivo**: Verificar scroll de muitos resultados

**Passos**:
1. Buscar termo genérico: `e`
2. Usar keyboard navigation (↓ múltiplas vezes)

**Resultado Esperado**:
- ✅ Dropdown tem scroll se > 10 items
- ✅ Max-height: 70vh
- ✅ Scroll automático para item selecionado
- ✅ Smooth scroll (behavior: smooth)

---

## 📊 CHECKLIST FINAL

### Funcionalidade Básica
- [ ] Autocomplete aparece após 2 caracteres
- [ ] Debounce de 300ms funciona
- [ ] Resultados são exibidos corretamente
- [ ] Highlight de termos funciona
- [ ] Agrupamento por tipo funcional

### Interação
- [ ] Keyboard navigation (↑↓←→ Enter Escape)
- [ ] Click em sugestão funciona
- [ ] Hover state visível
- [ ] Click fora fecha dropdown
- [ ] Botão X limpa busca

### Performance
- [ ] Debounce reduz requisições
- [ ] Cache funciona (5min TTL)
- [ ] AbortController cancela requests
- [ ] Sem memory leaks
- [ ] Response < 500ms

### UX/UI
- [ ] Loading indicator visível
- [ ] Error states tratados
- [ ] Empty states informativos
- [ ] Dark mode funciona
- [ ] Mobile overlay funcional

### Segurança
- [ ] Autenticação obrigatória
- [ ] Role-based access (admin vs user)
- [ ] XSS protegido
- [ ] SQL injection protegido
- [ ] Input sanitizado

### Acessibilidade
- [ ] ARIA labels completos
- [ ] Keyboard navigation completa
- [ ] Focus management correto
- [ ] Screen reader friendly
- [ ] Contraste adequado (WCAG AA)

---

## 🎯 MÉTRICAS DE SUCESSO

### Antes
- Busca simples sem sugestões
- Múltiplos cliques para encontrar item
- Sem feedback visual
- Experiência frustrante

### Depois
- Sugestões em tempo real
- Máximo 2 interações (digitar + enter)
- Feedback visual completo
- Experiência intuitiva

### KPIs
- ⏱️ Tempo para encontrar item: **-60%**
- 🖱️ Cliques necessários: **-40%**
- 😊 Satisfação do usuário: **+80%**
- 🎯 Taxa de uso da busca: **+150%**

---

## 📝 RELATÓRIO DE BUGS

**Template para reportar bugs**:

```markdown
### BUG: [Título Curto]

**Severidade**: 🔴 Alta / 🟡 Média / 🟢 Baixa

**Steps to Reproduce**:
1. ...
2. ...
3. ...

**Expected Result**:
- ...

**Actual Result**:
- ...

**Environment**:
- Browser: ...
- OS: ...
- Screen size: ...
- User role: ...

**Console Errors**:
```
...
```

**Screenshots**:
[Anexar se possível]

**Additional Notes**:
...
```

---

## ✅ CONCLUSÃO

Todos os testes acima devem passar para considerar a implementação completa e estável.

**Prioridade de Testes**:
1. 🔴 **P0 (Crítico)**: 1-12 (funcionalidade básica)
2. 🟡 **P1 (Alto)**: 13-18 (segurança e performance)
3. 🟢 **P2 (Médio)**: 19-24 (UX/UI)
4. 🔵 **P3 (Baixo)**: 25-30 (edge cases)

**Tempo Estimado**:
- Testes manuais completos: ~2 horas
- Testes automatizados (futuro): ~30 minutos

---

**Happy Testing!** 🚀
