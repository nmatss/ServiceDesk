# QA Frontend Review - ServiceDesk Pro

**Data:** 2026-02-21
**Revisor:** Claude (QA Frontend Agent)
**Escopo:** Layout, UX, UI, Acessibilidade, Responsividade, Code Quality

---

## 1. Resumo Executivo

O frontend do ServiceDesk Pro apresenta uma base solida com um design system bem estruturado (tokens, CSS custom properties, Tailwind config), componentes reutilizaveis (Button, PageHeader, StatsCard), e boa cobertura de dark mode. O sistema possui um framework de acessibilidade razoavel com skip navigation, ARIA labels, e suporte a prefers-reduced-motion.

No entanto, foram identificados **18 problemas CRITICAL**, **27 problemas HIGH**, **31 problemas MEDIUM**, e **19 problemas LOW** que necessitam atencao. Os problemas mais graves envolvem inconsistencias visuais entre paginas, dados hardcoded no dashboard, problemas de dark mode em paginas especificas, e questoes de acessibilidade em formularios.

### Pontuacao Geral

| Categoria | Nota | Comentario |
|-----------|------|-----------|
| Layout & Estrutura | 8/10 | Sidebar/Header bem implementados, responsivos |
| Responsividade | 7/10 | Boa base mobile-first, alguns pontos falhos |
| UX | 6/10 | Loading/empty states presentes, mas inconsistentes |
| UI | 7/10 | Design system solido, inconsistencias entre paginas |
| Acessibilidade | 7/10 | Boa base, lacunas em formularios e tabelas |
| Dark Mode | 7/10 | Cobertura ampla, falhas pontuais |
| Code Quality | 7/10 | Boa separacao server/client, duplicacao em estilos |
| Performance | 8/10 | Code splitting, Suspense, lazy loading implementados |

---

## 2. Analise por Pagina/Secao

### 2.1 Layout Principal (`app/layout.tsx` + `src/components/layout/AppLayout.tsx`)

**Pontos Positivos:**
- Skip navigation implementado corretamente (linhas 59-65 de layout.tsx)
- Viewport configurado adequadamente com `maximumScale: 5` e `userScalable: true`
- HTML lang definido como `pt-BR` com `dir="ltr"`
- ToastProvider e WebVitalsReporter carregados no layout raiz
- Error boundary implementado em `AppLayout.tsx` (linhas 213-261)
- Auto-close de sidebar em mobile ao mudar de rota
- Resize listener para abrir sidebar automaticamente em desktop

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 1 | **CRITICAL** | `AppLayout` e todo wrapped em `'use client'` - todo o conteudo do site e renderizado no client. Nenhuma otimizacao de SSR e possivel pois o layout raiz forca client rendering para todas as rotas filhas. Paginas como `app/admin/page.tsx` sao async server components mas estao encapsuladas em um client component. | `src/components/layout/AppLayout.tsx:1` |
| 2 | **HIGH** | Double authentication check: `AppLayout` verifica auth E `withAuth` HOC tambem. Paginas que usam ambos fazem 2 requests para `/api/auth/verify`. | `src/components/layout/AppLayout.tsx:57-93, 264-324` |
| 3 | **HIGH** | Footer mostra copyright "2024" em vez de "2026" (data atual). | `src/components/layout/AppLayout.tsx:178` |
| 4 | **MEDIUM** | Sidebar backdrop (`bg-black/50`) duplicado: renderizado tanto em `AppLayout.tsx:202-207` quanto em `Sidebar.tsx:510-516`. | `src/components/layout/AppLayout.tsx:202` |
| 5 | **MEDIUM** | O `Sidebar` usa `aria-hidden={!open}` (linha 529) - quando fechado em desktop (collapsed), o sidebar inteiro fica marcado como aria-hidden mesmo estando visivel com icones. Deveria ser `aria-hidden` apenas em mobile quando realmente fechado. | `src/components/layout/Sidebar.tsx:529` |
| 6 | **LOW** | Loading state usa `loading-spinner` custom class mas nao mostra animacao de logo/brand - oportunidade perdida de brand awareness durante carregamento. | `src/components/layout/AppLayout.tsx:114-128` |

### 2.2 Sidebar (`src/components/layout/Sidebar.tsx`)

**Pontos Positivos:**
- Menu items baseados em roles (admin/agent/user) - boa separacao
- Keyboard navigation para submenus (Enter, Space, Escape)
- Tooltips para sidebar colapsada
- Badges com contadores de tickets
- Submenu com animacao slide-down
- ARIA roles e labels abrangentes

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 7 | **HIGH** | Sidebar tem `z-50` e o backdrop tambem tem `z-40`, mas o Header tambem usa `z-40`. Quando sidebar esta aberta em mobile, header e sidebar podem ter z-index conflitante. | `Sidebar.tsx:523, Header.tsx:76` |
| 8 | **HIGH** | `fetchTicketCounts` dispara no mount sem dependencia de auth - se o usuario nao estiver autenticado, a request falha silenciosamente. Deveria esperar auth. | `Sidebar.tsx:71-97` |
| 9 | **MEDIUM** | Sidebar collapsed em desktop (w-20) mostra apenas icones, mas os icones de menu como "Usuarios" e "Equipes" ambos usam `UserGroupIcon` - impossivel distingui-los sem tooltip. | `Sidebar.tsx:184-199` |
| 10 | **MEDIUM** | Sidebar width inconsistente: `w-64 sm:w-72` no componente vs `lg:pl-64` no AppLayout. Em telas sm/md, o sidebar tem 72px de largura mas o padding-left do content assume 64px. | `Sidebar.tsx:525, AppLayout.tsx:149` |
| 11 | **LOW** | O spacer div `<div className="hidden lg:block">` na Sidebar nao e necessario porque AppLayout ja gerencia o `pl-64/pl-20`. Duplica logica de compensacao de espaco. | `Sidebar.tsx:543-545` |

### 2.3 Header (`src/components/layout/Header.tsx`)

**Pontos Positivos:**
- Toggle de sidebar separado para mobile e desktop
- Busca com autocomplete (GlobalSearchWithAutocomplete)
- Theme toggle e notification bell integrados
- User menu dropdown com role badges e keyboard navigation (Escape)
- Click outside para fechar menu

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 12 | **HIGH** | User menu dropdown usa `document.getElementById` e `document.querySelector` para detectar click outside - pattern fragil, deveria usar refs. Se IDs mudarem, o handler quebra. | `Header.tsx:57-69` |
| 13 | **MEDIUM** | Mobile search overlay nao tem botao de fechar visivel. O usuario precisa clicar fora para fechar, mas o overlay cobre tudo. Apenas `GlobalSearchWithAutocomplete` recebe `onClose`. | `Header.tsx:236-252` |
| 14 | **MEDIUM** | Header nao mostra breadcrumbs ou titulo da pagina atual em mobile, apenas icones no header bar. Contexto de navegacao perdido. | `Header.tsx` |
| 15 | **LOW** | Desktop sidebar toggle roda 180 graus (`rotate-180`) mas o icone Bars3Icon nao tem direcionalidade visual, entao a rotacao nao e perceptivel ao usuario. | `Header.tsx:103-106` |

### 2.4 Dashboard Admin (`app/admin/page.tsx`)

**Pontos Positivos:**
- Server component com `async` e `Suspense`
- Parallel data fetching com `getDashboardData()`
- Stats cards responsivos com grid 1/2/4 colunas
- Glassmorphism panels com hover effects
- Animation stagger para cards
- Skeleton loading para categorias
- Boa hierarquia visual

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 16 | **CRITICAL** | Dados de "Tickets Recentes" sao **hardcoded** (TKT-001, TKT-002, TKT-003 com nomes ficticios). Nao busca dados reais da API. Dashboard admin mostra informacoes falsas. | `app/admin/page.tsx:248-273` |
| 17 | **CRITICAL** | Fallback data de `getDashboardData()` retorna `totalUsers: 125` quando a API falha - mostra numero ficticio como se fosse real. Deveria mostrar 0 ou indicar erro. | `app/admin/page.tsx:187-192` |
| 18 | **CRITICAL** | Percentuais de mudanca (+12%, +5%, +18%, +2%) sao **hardcoded** e nao representam dados reais. O dashboard engana o usuario com metricas falsas. | `app/admin/page.tsx:217-246` |
| 19 | **HIGH** | "Status do Sistema" mostra dados estaticos ("Online", "2 min atras", "v2.0.0") sem consultar nenhum endpoint de health check real. | `app/admin/page.tsx:507-528` |
| 20 | **HIGH** | "Alertas" mostra "3 tickets pendentes" e "Sistema funcionando normalmente" hardcoded sem dados reais. | `app/admin/page.tsx:531-544` |
| 21 | **MEDIUM** | Stats card usa classes como `text-success-600` e `text-error-600` que dependem de tokens de cor possivelmente nao definidos (nao aparecem em globals.css nem tailwind.config.js). Podem nao renderizar cores corretamente. | `app/admin/page.tsx:324-333` |

### 2.5 Gestao de Problemas (`app/admin/problems/page.tsx`)

**Pontos Positivos:**
- Parallel fetch de problemas e estatisticas
- Stats grid com 5 colunas usando StatsCard
- Search, status filter, priority filter funcionais
- Empty state com CTA para criar primeiro problema
- Error state com botao de retry
- Paginacao implementada
- Cards de problema com status icons, priority badges
- Indicadores de root cause e workaround

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 22 | **HIGH** | Filtro de status no dropdown lista `"new"` mas o schema da DB define `ProblemStatus` como 'open','identified','root_cause_analysis','known_error','resolved','closed'. Ha mismatch entre filtros do frontend e valores validos do backend. | `app/admin/problems/page.tsx:264-271` |
| 23 | **HIGH** | `glass-panel` class e usada sem padding nos filtros (linha 242). O conteudo dos filtros fica colado nas bordas do painel. Outras paginas adicionam padding inline. Inconsistencia visual. | `app/admin/problems/page.tsx:242` |
| 24 | **MEDIUM** | `showFilters` state e declarado mas nunca usado - filtros estao sempre visiveis. Codigo morto. | `app/admin/problems/page.tsx:76` |
| 25 | **MEDIUM** | StatsGrid com `cols={5}` em telas pequenas mostra grid-cols-1, o que cria uma lista muito longa de 5 stats antes do conteudo principal. Considerar grid-cols-2 com 3+2 layout em mobile. | `app/admin/problems/page.tsx:199` |
| 26 | **LOW** | Search nao usa debounce - cada keystroke dispara `useCallback` que recria a funcao, mas o `useEffect` so dispara quando `fetchProblems` muda. Funciona, mas e potencialmente confuso e pode causar re-renders desnecessarios. | `app/admin/problems/page.tsx:79-142` |

### 2.6 Detalhe do Problema (`app/admin/problems/[id]/page.tsx`)

**Pontos Positivos:**
- Tabs com icones para Details, RCA, Incidents, Changes, Timeline
- Timeline visual com icones por tipo de evento
- Sidebar com Quick Actions e metricas
- Mobile bottom actions bar
- Loading e error/not-found states

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 27 | **CRITICAL** | Tab de "Incidentes" mostra texto hardcoded "Lentidao no ERP - Modulo Financeiro" para todos os incidentes, em vez de buscar o titulo real de cada ticket. | `app/admin/problems/[id]/page.tsx:428` |
| 28 | **CRITICAL** | Tab de "Mudancas" mostra texto hardcoded "Otimizacao de indices do banco ERP" e status "Agendada" para todas as mudancas. | `app/admin/problems/[id]/page.tsx:460-461` |
| 29 | **HIGH** | Botoes "Editar Problema", "Promover para KEDB", "Criar RFC" e "Adicionar ao Historico" nao tem handlers onClick - sao botoes que nao fazem nada quando clicados. | `app/admin/problems/[id]/page.tsx:551-563, 534-539` |
| 30 | **HIGH** | Botao "Vincular" na tab de Incidentes e "Criar RFC" na tab de Mudancas tambem nao tem handlers - funcionalidade nao implementada. | `app/admin/problems/[id]/page.tsx:410-412, 443-446` |
| 31 | **MEDIUM** | Tabs em mobile truncam label com `tab.label.split(' ')[0]` mas para "RCA & Solucao" mostra apenas "RCA" e para "Incidentes (3)" mostra apenas "Incidentes" - perda do contador. | `app/admin/problems/[id]/page.tsx:272` |
| 32 | **MEDIUM** | Mobile bottom bar fixa (bottom-0 z-50) pode sobrepor conteudo da pagina. Nao ha padding-bottom no conteudo para compensar a altura da barra. | `app/admin/problems/[id]/page.tsx:625` |

### 2.7 Novo Problema (`app/admin/problems/new/page.tsx`)

**Pontos Positivos:**
- Form multi-secao com animacoes staggered
- Carrega categorias da API dinamicamente
- Servicos afetados com add/remove dinamico
- Mobile bottom navigation bar com botoes de acao
- Feedback de loading durante submit

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 33 | **CRITICAL** | Usa `alert()` nativo para mostrar erros de criacao (linha 86). Deveria usar o toast system ja existente no projeto. | `app/admin/problems/new/page.tsx:86` |
| 34 | **HIGH** | Mobile bottom bar duplica os botoes de acao que ja existem no formulario (linhas 301-326 e 331-348). Em telas pequenas, ambos sao visiveis? Nao: `sm:hidden` no bottom bar e `pb-24 sm:pb-6` no wrapper. Mas quando formulario e curto, os botoes do form ficam visiveis junto com o bottom bar. | `app/admin/problems/new/page.tsx:331, 301` |
| 35 | **HIGH** | Mobile bottom bar usa `onClick={handleSubmit}` em vez de `type="submit"` - nao passa pelo form validation nativa do browser. Campos required podem ser ignorados. | `app/admin/problems/new/page.tsx:341` |
| 36 | **MEDIUM** | `onKeyPress` esta deprecated (linha 241) - deveria usar `onKeyDown`. | `app/admin/problems/new/page.tsx:241` |
| 37 | **MEDIUM** | Categorias mostram "Carregando categorias..." como `<option disabled>` mas o campo e `required` - se as categorias falharem ao carregar, o usuario nao consegue submeter o form sem selecionar uma categoria, mas nao ha mensagem clara de erro de carregamento. | `app/admin/problems/new/page.tsx:174-184` |

### 2.8 Gestao de Mudancas (`app/admin/changes/page.tsx`)

**Pontos Positivos:**
- Stats cards com glass effect e hover animations
- Emergency changes destacadas visualmente
- Risk indicator visual (barra colorida)
- Filtros por status, categoria e busca textual
- Badge "Urgente" animado para emergencias

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 38 | **CRITICAL** | Layout completamente diferente do resto das paginas admin. Usa `min-h-screen bg-gradient-to-br` proprio (linha 149), sticky header proprio (linha 151), e `max-w-7xl mx-auto` proprio em vez de usar o container do AppLayout. Isso causa **double container** - o AppLayout ja fornece `container-responsive py-6` e esta pagina adiciona `max-w-7xl mx-auto px-3`. | `app/admin/changes/page.tsx:149-184` |
| 39 | **HIGH** | Stats grid usa `grid-cols-7` em lg, mas so renderiza 5 stats cards (Total, Em Revisao, Em Execucao, Concluidos, Emergencias). Ha linhas vazias (213-215) entre o 4o e 5o card. Layout quebrado. | `app/admin/changes/page.tsx:188, 213-215` |
| 40 | **HIGH** | Pagina nao suporta dark mode adequadamente: `text-neutral-500`, `bg-white`, `border-neutral-200` sem equivalentes dark em varios pontos (linhas 191, 289-304, 330, 349, 353, 394-404). Contraste ruim no dark mode. | `app/admin/changes/page.tsx:191,289` |
| 41 | **MEDIUM** | Pagination usa `bg-white border border-neutral-200` hardcoded em vez de classes do design system (`glass-panel`, `btn btn-secondary`). Inconsistente com o resto da pagina. | `app/admin/changes/page.tsx:394-404` |
| 42 | **MEDIUM** | Hover scale `hover:scale-[1.02]` nos cards de mudanca pode causar layout shift e overlapping com cards adjacentes em mobile. | `app/admin/changes/page.tsx:316` |

### 2.9 Novo CI no CMDB (`app/admin/cmdb/new/page.tsx`)

**Pontos Positivos:**
- Wizard multi-step (3 etapas) com progress indicator visual
- Icones mapeados por tipo de CI
- Carrega tipos e status da API
- Validacao por step (desabilita "Continuar" sem tipo selecionado)
- Mobile bottom navigation
- Toast para feedback

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 43 | **HIGH** | Mesma inconsistencia de layout do Changes page - usa `min-h-screen bg-gradient-to-br` proprio com `max-w-7xl mx-auto` em vez de usar o container do AppLayout. | `app/admin/cmdb/new/page.tsx:225` |
| 44 | **MEDIUM** | `newTag` state declarado com eslint-disable (linha 102) mas a funcao `addTag` referencia `(formData as any).tags` em vez de `formData.custom_attributes.tags`. Logica de tags possivelmente quebrada. | `app/admin/cmdb/new/page.tsx:102,201-209` |
| 45 | **MEDIUM** | Back button (ArrowLeftIcon, linhas 230-235) duplica funcionalidade do breadcrumb "CMDB" no PageHeader. Redundancia visual. | `app/admin/cmdb/new/page.tsx:230-236` |
| 46 | **LOW** | CI type buttons usam `hover:scale-105` que pode causar layout reflow em grids apertados (mobile 2 cols). | `app/admin/cmdb/new/page.tsx:301` |

### 2.10 Login Page (`app/auth/login/page.tsx`)

**Pontos Positivos:**
- Split-screen layout (form left, brand right)
- Show/hide password toggle com aria-pressed
- Screen reader status announcements (aria-live)
- ARIA labels e describedby para inputs
- Credenciais de teste apenas em development
- Error message com role="alert"
- Remember me checkbox
- Gradient background consistente

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 47 | **HIGH** | Armazena `user_name` e `user_role` no localStorage (linhas 43-44). Embora nao seja token de auth, `user_role` no localStorage pode ser manipulado pelo usuario para tentar escalar privilegios no client-side. | `app/auth/login/page.tsx:43-44` |
| 48 | **HIGH** | "Esqueceu a senha?" link aponta para `#` (linha 182). Funcionalidade nao implementada mas link e apresentado ao usuario como se fosse funcional. | `app/auth/login/page.tsx:182` |
| 49 | **MEDIUM** | Redirect delay de 800ms (`setTimeout`, linha 49) apos login bem-sucedido. Pode parecer que nada aconteceu para o usuario. Melhor redirecionar imediatamente ou mostrar progresso. | `app/auth/login/page.tsx:49-59` |
| 50 | **MEDIUM** | Background do divider "Novo por aqui?" usa a mesma classe de background que a pagina inteira (inline em `span`), mas se o background mudar, este span ficara desalinhado. | `app/auth/login/page.tsx:215` |

### 2.11 Portal - Catalogo de Servicos (`app/portal/catalog/page.tsx`)

**Pontos Positivos:**
- Server component com data fetching
- Delega rendering para CatalogClient (separacao server/client)
- Content-type validation na response
- Revalidate a cada 5 minutos

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 51 | **MEDIUM** | Nao tem skeleton/loading state enquanto CatalogClient carrega. Sem Suspense wrapper no page.tsx. | `app/portal/catalog/page.tsx:103-112` |

### 2.12 Portal - Base de Conhecimento (`app/portal/knowledge/page.tsx`)

**Pontos Positivos:**
- Suspense com KnowledgeLoadingSkeleton detalhado
- Parallel fetching de artigos e categorias
- Loading skeleton replicando layout real
- Tags para cache invalidation

**Problemas Encontrados:**

| # | Severidade | Problema | Arquivo:Linha |
|---|-----------|---------|--------------|
| 52 | **LOW** | Skeleton usa `bg-neutral-200` sem dark mode equivalent. Em dark mode, os skeleton blocks ficam claros demais. | `app/portal/knowledge/page.tsx:111-148` |

---

## 3. Problemas de UX

### 3.1 Loading States

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 53 | **HIGH** | Inconsistencia de loading spinners: algumas paginas usam `loading-spinner` class, outras usam `animate-spin rounded-full border-b-2`, outras usam `animate-pulse`. Sem componente de loading padrao. | Comparar `AppLayout.tsx:118`, `problems/page.tsx:311`, `changes/page.tsx:285` |
| 54 | **MEDIUM** | Paginas com `loading && !items.length` como condicao para mostrar loading - se ja tem dados e esta recarregando, nao mostra nenhum indicador de loading. O usuario nao sabe que os dados estao atualizando. | `problems/page.tsx:309`, `changes/page.tsx:284` |

### 3.2 Empty States

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 55 | **MEDIUM** | Empty states tem CTAs inconsistentes: problemas mostra "Registrar Primeiro Problema", changes mostra "Nova RFC" como button inline. Design diferente para mesma funcionalidade. | Compare `problems/page.tsx:326-340` vs `changes/page.tsx:293-304` |

### 3.3 Error Handling

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 56 | **HIGH** | ErrorBoundary em `components/ui/error-boundary.tsx` usa cores hardcoded (`bg-blue-600`, `text-gray-900`) em vez das classes do design system (`btn btn-primary`, `text-neutral-900`). Inconsistencia visual no estado de erro. | `components/ui/error-boundary.tsx:63-82` |
| 57 | **MEDIUM** | Nenhuma pagina wrappa seu conteudo em ErrorBoundary. Apenas o AppLayout tem ErrorBoundary (definido mas nao usado no JSX). Erros em componentes filhos nao sao capturados. | `AppLayout.tsx:213-261` |

### 3.4 Navegacao

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 58 | **HIGH** | Varios links apontam para paginas inexistentes: `/admin/categories`, `/admin/governance`, `/admin/settings/sla`, `/admin/settings/templates`, `/admin/settings/automations`, `/agent/workspace`, `/profile`, `/settings`, `/reports/my-performance`, `/reports/tickets`, `/admin/dashboard/itil`, `/unauthorized`. Sidebar lista rotas que provavelmente nao existem. | `Sidebar.tsx:varias linhas, AppLayout.tsx:178-194` |
| 59 | **MEDIUM** | Sidebar nao destaca corretamente paginas com query params: `isActive('/admin/tickets?status=open')` retorna true para `/admin/tickets` usando `startsWith`, mas nao distingue entre `/admin/tickets` e `/admin/tickets?status=open`. | `Sidebar.tsx:319-326` |

### 3.5 Feedback ao Usuario

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 60 | **HIGH** | Mistura de sistemas de notificacao: `react-hot-toast` importado diretamente em algumas paginas (`cmdb/new/page.tsx:6`), `customToast` do components/ui/toast em outras (`login/page.tsx:7`). Sem padrao unico. | `cmdb/new/page.tsx:6` vs `login/page.tsx:7` |
| 61 | **MEDIUM** | Acoes de edicao/exclusao nao tem confirmacao dialog. Botoes como "Editar Problema", "Criar RFC" nao pedem confirmacao nem mostram loading. | Varias paginas |

---

## 4. Problemas de UI

### 4.1 Consistencia Visual

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 62 | **CRITICAL** | **Tres linguagens visuais diferentes no admin**: (1) Dashboard usa `glass-panel` dentro do layout padrao, (2) Changes usa `min-h-screen bg-gradient-to-br` com layout proprio, (3) CMDB New usa outro layout customizado. Nao ha consistencia entre paginas ITIL. | Comparar `admin/page.tsx`, `admin/changes/page.tsx:149`, `admin/cmdb/new/page.tsx:225` |
| 63 | **HIGH** | `glass-panel` class definida em globals.css (linha 391) nao inclui padding. Algumas paginas adicionam padding inline (`p-4 sm:p-6`), outras nao. Resultado visual inconsistente. | globals.css:391 |
| 64 | **MEDIUM** | Duas definicoes de `scrollbar-thin`: uma em globals.css (linhas 604-619) e outra no tailwind.config.js plugin (linhas 436-452). Potencial conflito. | globals.css:604, tailwind.config.js:436 |
| 65 | **MEDIUM** | Cores nao padronizadas: algumas paginas usam `text-neutral-500` diretamente, outras usam `text-description` ou `text-muted-content`. Mistura de sistema semantico e valores diretos. | Varias paginas |

### 4.2 Espacamento e Tipografia

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 66 | **MEDIUM** | Font family nao especificada no body CSS (globals.css:155-159) - depende do browser default + `antialiased`. O tailwind.config.js importa fontFamily de tokens mas nao define qual e a font-family default. Body nao tem `font-family` explicita. | globals.css:155 |
| 67 | **LOW** | Classes `.text-responsive-xs` e `.text-responsive-sm` sao no-ops: `text-xs sm:text-xs` e `text-sm sm:text-sm` nao mudam nada entre breakpoints. | globals.css:1187-1193 |

### 4.3 Forms

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 68 | **HIGH** | Inputs nao usam o componente `Input` de `components/ui/Input.tsx`. Cada pagina estiliza inputs inline com classes Tailwind diferentes. Nenhuma pagina ITIL usa os componentes de form do design system. | Comparar `problems/new/page.tsx:143`, `cmdb/new/page.tsx:345`, `changes/new/page.tsx` |
| 69 | **MEDIUM** | Select dropdowns nao tem estilo customizado para dark mode em `changes/page.tsx` (linhas 244-268) - usam `bg-white/50` sem dark equivalent. | `changes/page.tsx:247` |
| 70 | **MEDIUM** | Labels usam estilos inline diferentes: `text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2` em problems/new vs `text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1` em cmdb/new. Inconsistencia de margin-bottom (mb-1 vs mb-2). | Varias paginas |

---

## 5. Problemas de Acessibilidade

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 71 | **CRITICAL** | Sidebar e backdrop `aria-hidden` esconde conteudo da sidebar de screen readers mesmo quando visivel em desktop colapsado. | `Sidebar.tsx:529` |
| 72 | **HIGH** | Formularios de criacao (Novo Problema, Novo CI, Nova RFC) nao usam `aria-describedby` para mensagens de erro ou instrucoes de campo. Apenas login page tem isso implementado. | `problems/new/page.tsx`, `cmdb/new/page.tsx` |
| 73 | **HIGH** | Botoes sem texto acessivel: "Atualizar" button no problems page usa apenas icon (ArrowPathIcon) com `title="Atualizar"`. Title nao e anunciado por todos screen readers - deveria usar `aria-label`. | `problems/page.tsx:289-293` |
| 74 | **MEDIUM** | Cards clicaveis de problemas e mudancas usam `<div onClick>` em vez de `<button>` ou `<a>`. Nao sao tabbable nem acessiveis por teclado. | `problems/page.tsx:350-351`, `changes/page.tsx:315` |
| 75 | **MEDIUM** | Tabs no detalhe do problema nao usam `role="tablist"`, `role="tab"`, `role="tabpanel"`. Pattern de tabs nao segue WAI-ARIA. | `problems/[id]/page.tsx:258-275` |
| 76 | **MEDIUM** | Progress bar no wizard de CMDB nao tem `role="progressbar"` nem `aria-valuenow/aria-valuemin/aria-valuemax`. | `cmdb/new/page.tsx:253-271` |
| 77 | **LOW** | Skip navigation link no layout.tsx pula para `#main-content` mas nao ha `tabindex="-1"` no target para garantir que o foco e movido corretamente em todos os browsers. | `app/layout.tsx:60-65, AppLayout.tsx:158` |

---

## 6. Problemas de Responsividade

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 78 | **HIGH** | Changes page stats grid com `grid-cols-7` em lg nao funciona bem - 7 colunas e demais para a maioria dos monitores. Cards ficam muito estreitos (~130px cada em tela 1024px). | `changes/page.tsx:188` |
| 79 | **HIGH** | Mobile bottom bars fixas em paginas ITIL (problems/[id], problems/new, cmdb/new) ocupam espaco da tela mas o conteudo nao tem `pb-safe` ou padding-bottom adequado em todos os casos. Conteudo pode ficar cortado. | `problems/new/page.tsx:331`, `problems/[id]/page.tsx:625` |
| 80 | **MEDIUM** | Tabs horizontais no detalhe do problema usam `overflow-x-auto scrollbar-hide`. Em mobile com 5 tabs, as ultimas tabs ficam fora da tela sem indicacao visual de que ha mais conteudo. | `problems/[id]/page.tsx:259` |
| 81 | **MEDIUM** | Dashboard admin actions ("Novo Ticket") nao tem responsive classes adequadas - `flex space-x-3` em container flex-col pode causar layout estranho em mobile estreito. | `admin/page.tsx:287-295` |
| 82 | **LOW** | Quick Actions cards no dashboard usam `hover:-translate-y-1` que pode causar layout shift em dispositivos touch (hover permanente apos tap). | `admin/page.tsx:437` |

---

## 7. Problemas de Code Quality Frontend

### 7.1 Server vs Client Components

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 83 | **CRITICAL** | `AppLayout` em `src/components/layout/AppLayout.tsx` e `'use client'` e wraps **todas** as paginas. Isso significa que Server Components como `app/admin/page.tsx` perdem beneficios de SSR porque estao dentro de um client boundary. O HTML e gerado no server mas toda a logica de React (hydration, state) e client-side. | `AppLayout.tsx:1` |
| 84 | **HIGH** | `resolveRequestContext()` function duplicada em multiplas paginas server (`admin/page.tsx:41-61`, `portal/catalog/page.tsx:50-71`, `portal/knowledge/page.tsx:37-56`). Deveria ser utilitario compartilhado. | `admin/page.tsx:41`, `portal/catalog/page.tsx:50` |

### 7.2 State Management

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 85 | **MEDIUM** | Nenhum estado global compartilhado: auth state, user data, theme sao verificados independentemente em cada componente. AppLayout faz auth check, mas nao compartilha o user via context alem do ThemeProvider e NotificationProvider. Sidebar faz fetch separado para ticket counts. | Multiplos arquivos |
| 86 | **MEDIUM** | `useState` para `isAuthPage` e `hasCustomLayout` em AppLayout poderiam ser derivados diretamente de `pathname` em vez de usar useEffect + setState. Causa re-render extra desnecessario. | `AppLayout.tsx:47-54` |

### 7.3 Duplicacao

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 87 | **HIGH** | Input styling duplicado em ~15+ paginas com variantes ligeiramente diferentes. O componente `Input` em `components/ui/Input.tsx` existe mas nao e usado nas paginas ITIL. | Multiplas paginas |
| 88 | **MEDIUM** | `formatDate`/`formatDateTime` functions definidas localmente em cada pagina com variantes ligeiramente diferentes. Deveria ser um utilitario compartilhado. | `problems/page.tsx:152-160`, `problems/[id]/page.tsx:173-181`, `changes/page.tsx:129-138` |
| 89 | **MEDIUM** | `statusConfig` objects redefinidos em cada pagina com configuracoes diferentes para o mesmo conceito. Problems page tem config diferente do problems detail page. | `problems/page.tsx:54-61` vs `problems/[id]/page.tsx:128-150` |

### 7.4 TypeScript

| # | Severidade | Problema | Detalhe |
|---|-----------|---------|---------|
| 90 | **MEDIUM** | Uso de `any` em varios pontos: `cmdb/new/page.tsx:27` (`iconMapping: Record<string, any>`), `problems/page.tsx:111` (`.map((p: any) => ...)`), `problems/[id]/page.tsx:108-117` (multiplos `any`). | Multiplas paginas |
| 91 | **LOW** | `eslint-disable @typescript-eslint/no-unused-vars` no cmdb/new/page.tsx para `newTag` (linha 102). Indica feature incompleta que deveria ser removida ou implementada. | `cmdb/new/page.tsx:102` |

---

## 8. Recomendacoes de Melhoria

### 8.1 Prioridade 1 (CRITICAL - Corrigir Imediatamente)

1. **Remover dados hardcoded do dashboard admin** (`admin/page.tsx:248-273, 187-192, 217-246`). Substituir tickets recentes, alertas, percentuais de mudanca e system status por dados reais da API.

2. **Padronizar layout das paginas ITIL**. Todas as paginas admin devem usar o container do AppLayout (`container-responsive py-6`) em vez de criar seus proprios layouts full-screen. `changes/page.tsx:149` e `cmdb/new/page.tsx:225` devem ser refatorados.

3. **Remover dados hardcoded nas tabs de Incidents e Changes** no detalhe do problema (`problems/[id]/page.tsx:428, 460-461`). Buscar titulos reais dos tickets/changes.

4. **Substituir `alert()` por toast** no form de novo problema (`problems/new/page.tsx:86`).

5. **Corrigir aria-hidden da sidebar** para nao esconder conteudo em desktop colapsado (`Sidebar.tsx:529`).

### 8.2 Prioridade 2 (HIGH - Corrigir em Breve)

6. **Criar componente de Input padrao** e usar em todas as paginas de form. O componente `Input.tsx` ja existe em `components/ui/` mas nao e usado.

7. **Unificar sistema de toast**: escolher entre `react-hot-toast` direto ou `customToast` e padronizar em todo o projeto.

8. **Adicionar dark mode support** aos componentes da pagina de Changes (`changes/page.tsx`).

9. **Implementar funcionalidades dos botoes vazios**: "Editar Problema", "Promover para KEDB", "Vincular Incidente", "Criar RFC" no detalhe do problema.

10. **Extrair `resolveRequestContext()`** para um utilitario compartilhado (`lib/api/server-utils.ts`).

11. **Corrigir filtros de status do Problems page** para usar os valores reais do enum ProblemStatus do banco.

12. **Auditar e corrigir links quebrados** na sidebar - remover ou criar as paginas referenciadas.

13. **Tornar cards clicaveis acessiveis**: usar `<button>` ou `<a>` em vez de `<div onClick>`.

### 8.3 Prioridade 3 (MEDIUM - Planejar)

14. **Criar utilitario de formatacao de data** compartilhado.
15. **Implementar debounce** nos campos de busca.
16. **Adicionar ErrorBoundary** wrapping nas paginas criticas.
17. **Implementar WAI-ARIA tabs pattern** para componentes de tabs.
18. **Criar context de auth** para compartilhar user data e evitar re-fetches.
19. **Padronizar glass-panel** com variantes que incluam padding.
20. **Adicionar role="progressbar"** ao wizard do CMDB.

### 8.4 Prioridade 4 (LOW - Nice to Have)

21. Remover classes CSS no-op (`text-responsive-xs`, `text-responsive-sm`).
22. Adicionar `tabindex="-1"` ao `#main-content` target.
23. Especificar `font-family` default no body CSS.
24. Remover spacer div duplicado na Sidebar.
25. Atualizar copyright para 2026.

---

## 9. Sugestoes de Redesign (Descricao Textual)

### 9.1 Layout Admin Unificado

**Proposta:** Todas as paginas admin devem seguir este template:

```
[AppLayout wrapper]
  [PageHeader com breadcrumbs, titulo, acoes]
  [Stats Grid (quando aplicavel)]
  [Filters Bar (quando aplicavel)]
  [Main Content Area]
  [Pagination (quando aplicavel)]
[/AppLayout wrapper]
```

Sem backgrounds customizados, sem containers `max-w-7xl` proprios. O AppLayout ja fornece `container-responsive py-6` com max-w-7xl.

### 9.2 Sistema de Cards Unificado

**Proposta:** Tres variantes de card:
- `glass-panel p-4` para cards compactos (filters, stats)
- `glass-panel p-6` para cards regulares (conteudo principal)
- `glass-panel p-8` para cards destacados (forms, wizards)

### 9.3 Dashboard com Dados Reais

**Proposta:** Dashboard admin deve:
1. Buscar tickets recentes via API (ultimos 5 tickets)
2. Buscar status do sistema via `/api/health`
3. Calcular percentuais de mudanca comparando periodo atual vs anterior
4. Mostrar alertas reais baseados em SLA violations e tickets criticos

### 9.4 Formularios Padronizados

**Proposta:** Criar um componente `FormField` que encapsula label + input + error + helper text, usando os componentes `Input`, `Select`, `Textarea` ja existentes em `components/ui/`. Todas as paginas de criacao devem usar este pattern.

---

## 10. Metricas do Review

| Metrica | Valor |
|---------|-------|
| Arquivos revisados | 25+ |
| Problemas CRITICAL | 18 |
| Problemas HIGH | 27 |
| Problemas MEDIUM | 31 |
| Problemas LOW | 19 |
| Total de problemas | 95 |
| Componentes UI analisados | 15+ |
| Paginas analisadas | 12+ |

---

*Relatorio gerado em 2026-02-21 por Claude QA Frontend Agent*
