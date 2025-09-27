# ServiceDesk - Sistema de Help Desk

Sistema completo de help desk e gerenciamento de tickets, desenvolvido com Next.js, TypeScript, Tailwind CSS e SQLite.

## 🚀 Tecnologias Utilizadas

- **Next.js 14** - Framework React para produção
- **TypeScript** - Tipagem estática para JavaScript
- **Tailwind CSS** - Framework CSS utilitário
- **Headless UI** - Componentes acessíveis sem estilos
- **Heroicons** - Ícones SVG otimizados
- **SQLite** - Banco de dados local (desenvolvimento)
- **better-sqlite3** - Driver SQLite para Node.js

## 📋 Funcionalidades

### Sistema de Tickets
- ✅ Criação e gerenciamento de tickets
- ✅ Categorização por tipo de problema
- ✅ Sistema de prioridades (Baixa, Média, Alta, Crítica)
- ✅ Status de acompanhamento (Novo, Em Andamento, Resolvido, etc.)
- ✅ Atribuição de tickets para agentes
- ✅ Comentários públicos e internos
- ✅ Anexos de arquivos

### Gestão de Usuários
- ✅ Sistema de roles (Admin, Agente, Usuário)
- ✅ Autenticação e autorização
- ✅ Perfis de usuário

### Banco de Dados
- ✅ SQLite para desenvolvimento
- ✅ Schema completo com relacionamentos
- ✅ Dados iniciais (seed) incluídos
- ✅ Queries otimizadas com índices
- ✅ Triggers para timestamps automáticos

### Interface
- ✅ Layout responsivo completo
- ✅ Navegação com menu mobile
- ✅ Componentes acessíveis
- ✅ Tipagem TypeScript rigorosa
- ✅ Build otimizado para produção

## 🛠️ Instalação e Execução

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn

### Instalação
```bash
npm install
```

### Configuração do Banco de Dados
```bash
# Inicializar o banco de dados SQLite
npm run init-db

# Testar o banco de dados
npm run test-db
```

### Desenvolvimento
```bash
npm run dev
```
Acesse: http://localhost:3000

### Build para Produção
```bash
npm run build
npm start
```

### Scripts Disponíveis
```bash
# Desenvolvimento
npm run dev              # Servidor de desenvolvimento
npm run build            # Build para produção
npm run start            # Servidor de produção
npm run lint             # Linting do código
npm run type-check       # Verificação de tipos TypeScript

# Banco de Dados
npm run init-db          # Inicializar banco completo
npm run test-db          # Testar banco de dados
npm run db:seed          # Apenas inserir dados iniciais
npm run db:clear         # Limpar todos os dados
```

## 📁 Estrutura do Projeto

```
ServiceDesk/
├── app/                    # App Router do Next.js
│   ├── globals.css         # Estilos globais Tailwind
│   ├── layout.tsx          # Layout principal
│   └── page.tsx            # Página principal
├── lib/                    # Bibliotecas e utilitários
│   ├── db/                 # Banco de dados
│   │   ├── connection.ts   # Conexão SQLite
│   │   ├── init.ts         # Inicialização
│   │   ├── schema.sql      # Schema das tabelas
│   │   ├── seed.ts         # Dados iniciais
│   │   ├── queries.ts      # Funções de consulta
│   │   ├── config.ts       # Configurações
│   │   └── README.md       # Documentação do banco
│   └── types/              # Tipos TypeScript
│       └── database.ts     # Tipos do banco
├── scripts/                # Scripts utilitários
│   ├── init-db.ts          # Inicialização do banco
│   └── test-db.ts          # Teste do banco
├── data/                   # Dados do banco (gitignored)
│   └── servicedesk.db      # Arquivo SQLite
├── package.json            # Dependências e scripts
├── tsconfig.json          # Configuração TypeScript
├── tailwind.config.js     # Configuração Tailwind
├── next.config.js         # Configuração Next.js
└── README.md              # Este arquivo
```

## 🗄️ Banco de Dados

### Estrutura das Tabelas
- **users**: Usuários do sistema (admin, agent, user)
- **categories**: Categorias de tickets
- **priorities**: Níveis de prioridade
- **statuses**: Status dos tickets
- **tickets**: Tickets de suporte
- **comments**: Comentários nos tickets
- **attachments**: Anexos dos tickets

### Dados Iniciais
O banco é inicializado com:
- 7 usuários (1 admin, 3 agentes, 3 usuários)
- 6 categorias (Suporte Técnico, Solicitação, Bug Report, etc.)
- 4 prioridades (Baixa, Média, Alta, Crítica)
- 7 status (Novo, Em Andamento, Resolvido, etc.)
- 4 tickets de exemplo com comentários

### Queries Disponíveis
```typescript
import { userQueries, ticketQueries, categoryQueries } from '@/lib/db';

// Buscar todos os usuários
const users = userQueries.getAll();

// Buscar tickets com detalhes
const tickets = ticketQueries.getAll();

// Criar novo ticket
const newTicket = ticketQueries.create({
  title: 'Novo problema',
  description: 'Descrição do problema',
  user_id: 1,
  category_id: 1,
  priority_id: 2,
  status_id: 1
});
```

## 🎨 Componentes Implementados

### Header
- Navegação responsiva
- Menu mobile com Dialog do Headless UI
- Logo e links de navegação

### Hero Section
- Título principal "ServiceDesk"
- Descrição e call-to-action
- Galeria de imagens em grid responsivo

### Seções de Conteúdo
- **Missão**: Texto descritivo com estatísticas
- **Valores**: Grid de valores da empresa
- **Equipe**: Cards de membros da equipe
- **Blog**: Artigos em grid responsivo

### Footer
- Links de navegação
- Ícones de redes sociais
- Copyright

## 🔧 Correções Aplicadas

Seguindo as instruções do prompt, foram aplicadas as seguintes correções:

1. **Tipos TypeScript**: Removido uso de `any`, implementados tipos específicos
2. **Props de Ícones**: Corrigidos tipos para `React.SVGProps<SVGSVGElement>`
3. **Caracteres Especiais**: Escapados caracteres em JSX usando entidades HTML
4. **Imports**: Corrigido import do `Dialog.Panel` do Headless UI

## ✅ Verificações Realizadas

- [x] TypeScript compilation sem erros
- [x] Build de produção bem-sucedido
- [x] Servidor de desenvolvimento funcionando
- [x] Página carregando corretamente
- [x] Responsividade funcionando
- [x] Componentes acessíveis

## 🌐 Acesso

O projeto está rodando em: **http://localhost:3002**

## 📝 Notas de Desenvolvimento

- O projeto foi configurado seguindo as melhores práticas do Next.js 14
- Todos os componentes são totalmente tipados com TypeScript
- O design é responsivo e acessível
- As imagens são otimizadas e carregadas de forma lazy
- O código segue as convenções do React e Next.js

## 🚀 Migração para Neon (PostgreSQL)

O sistema está preparado para migração do SQLite para o Neon (PostgreSQL):

### Preparação
- Schema SQL compatível com PostgreSQL
- Configurações de banco centralizadas em `lib/db/config.ts`
- Queries preparadas para ORM (Prisma/Drizzle)

### Próximos Passos
1. Configurar variável de ambiente `DATABASE_URL`
2. Instalar ORM (Prisma ou Drizzle)
3. Converter schema SQL para migrations
4. Migrar dados existentes
5. Atualizar queries para usar ORM

### Vantagens do Neon
- Banco PostgreSQL gerenciado
- Escalabilidade automática
- Backup automático
- Conexões serverless
- Compatibilidade com SQLite

## 🚨 Importante

Este sistema está pronto para desenvolvimento com SQLite e preparado para migração para produção com Neon PostgreSQL.
