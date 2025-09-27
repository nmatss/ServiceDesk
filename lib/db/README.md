# ServiceDesk Database

Este diretório contém toda a configuração e estrutura do banco de dados SQLite do ServiceDesk.

## Estrutura

```
lib/db/
├── connection.ts    # Conexão com o banco SQLite
├── init.ts         # Inicialização do banco
├── schema.sql      # Schema das tabelas
├── seed.ts         # Dados iniciais
├── queries.ts      # Funções de consulta
├── index.ts        # Exportações principais
└── README.md       # Esta documentação
```

## Como usar

### 1. Inicializar o banco de dados

```bash
npm run init-db
```

Este comando irá:
- Criar o arquivo do banco em `./data/servicedesk.db`
- Executar o schema SQL
- Inserir dados iniciais (usuários, categorias, prioridades, status, tickets de exemplo)

### 2. Usar as queries no código

```typescript
import { userQueries, ticketQueries, categoryQueries } from '@/lib/db';

// Buscar todos os usuários
const users = userQueries.getAll();

// Buscar ticket por ID
const ticket = ticketQueries.getById(1);

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

### 3. Scripts disponíveis

```bash
# Inicializar banco completo
npm run init-db

# Apenas inserir dados iniciais
npm run db:seed

# Limpar todos os dados
npm run db:clear
```

## Estrutura das Tabelas

### Users
- `id`: ID único
- `name`: Nome do usuário
- `email`: Email único
- `role`: admin, agent, user
- `created_at`, `updated_at`: Timestamps

### Categories
- `id`: ID único
- `name`: Nome da categoria
- `description`: Descrição opcional
- `color`: Cor para UI
- `created_at`, `updated_at`: Timestamps

### Priorities
- `id`: ID único
- `name`: Nome da prioridade
- `level`: Nível (1-4)
- `color`: Cor para UI
- `created_at`, `updated_at`: Timestamps

### Statuses
- `id`: ID único
- `name`: Nome do status
- `description`: Descrição opcional
- `color`: Cor para UI
- `is_final`: Se é status final
- `created_at`, `updated_at`: Timestamps

### Tickets
- `id`: ID único
- `title`: Título do ticket
- `description`: Descrição detalhada
- `user_id`: ID do usuário que criou
- `assigned_to`: ID do agente responsável
- `category_id`: ID da categoria
- `priority_id`: ID da prioridade
- `status_id`: ID do status
- `created_at`, `updated_at`: Timestamps
- `resolved_at`: Data de resolução

### Comments
- `id`: ID único
- `ticket_id`: ID do ticket
- `user_id`: ID do usuário
- `content`: Conteúdo do comentário
- `is_internal`: Se é comentário interno
- `created_at`, `updated_at`: Timestamps

### Attachments
- `id`: ID único
- `ticket_id`: ID do ticket
- `filename`: Nome do arquivo no sistema
- `original_name`: Nome original
- `mime_type`: Tipo MIME
- `size`: Tamanho em bytes
- `uploaded_by`: ID do usuário que fez upload
- `created_at`: Timestamp

## Dados Iniciais

O banco é inicializado com:

- **7 usuários**: 1 admin, 3 agentes, 3 usuários
- **6 categorias**: Suporte Técnico, Solicitação, Bug Report, Dúvida, Acesso, Outros
- **4 prioridades**: Baixa, Média, Alta, Crítica
- **7 status**: Novo, Em Andamento, Aguardando Cliente, Aguardando Terceiros, Resolvido, Fechado, Cancelado
- **4 tickets de exemplo** com comentários

## Migração para Neon (PostgreSQL)

Quando estivermos prontos para migrar para o Neon:

1. O schema SQL será convertido para PostgreSQL
2. As queries serão adaptadas para usar um ORM (Prisma/Drizzle)
3. Os dados serão migrados usando scripts de migração
4. A conexão será alterada para usar a string de conexão do Neon

## Performance

O banco SQLite está configurado com:
- WAL mode para melhor concorrência
- Cache de 1000 páginas
- Índices nas colunas mais consultadas
- Triggers para atualizar `updated_at` automaticamente

