# ✅ Checklist de Validação - Migração PostgreSQL

Use este checklist para validar cada etapa da migração.

---

## 📋 Pré-Migração

### Ambiente
- [ ] Node.js ≥ 18.0.0 instalado
- [ ] npm ≥ 9.0.0 instalado
- [ ] `@neondatabase/serverless` instalado
- [ ] Variável `DATABASE_URL` configurada
- [ ] Conta Neon criada (https://neon.tech)

### Arquivos
- [ ] `lib/db/schema.postgres.sql` existe
- [ ] `lib/db/migrations/001_initial_schema.sql` existe
- [ ] `lib/db/migration-manager.ts` existe
- [ ] `lib/db/connection.postgres.ts` existe
- [ ] `lib/db/adapter.ts` existe
- [ ] `lib/db/config.ts` atualizado

### Configuração
```bash
# Executar cada comando e verificar output

# 1. Tipo de banco
node -e "console.log(require('./lib/db/config').getDatabaseType())"
# Esperado: 'postgresql' (com DATABASE_URL) ou 'sqlite' (sem)

# 2. Validação de config
node -e "console.log(require('./lib/db/config').validateDatabaseConfig())"
# Esperado: { valid: true, errors: [], warnings: [] }

# 3. Info do banco
npm run db:info
# Verificar: Type, Environment, URL, SSL, Pool Size
```

---

## 🔄 Durante Migração

### Execução de Migrations
```bash
# 1. Status inicial
npm run migrate:status
# Esperado: Lista de migrations com status 'pending'

# 2. Aplicar migrations
npm run migrate
# Esperado: "Migration applied successfully"

# 3. Status pós-migração
npm run migrate:status
# Esperado: Todas migrations com status 'applied'
```

### Validação de Tabelas
```bash
# Conectar ao banco e verificar

# PostgreSQL (psql)
psql $DATABASE_URL

# Listar tabelas
\dt
# Esperado: 55+ tabelas

# Verificar schema_migrations
SELECT * FROM schema_migrations ORDER BY version;
# Esperado: version=1, status='applied'

# Contar tabelas
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';
# Esperado: 55+

# Verificar índices
SELECT COUNT(*) FROM pg_indexes 
WHERE schemaname = 'public';
# Esperado: 223+

# Verificar triggers
SELECT COUNT(*) FROM pg_trigger 
WHERE tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 
  (SELECT oid FROM pg_namespace WHERE nspname = 'public'));
# Esperado: 42+
```

### Health Checks
```bash
# 1. Connection health
node -e "require('./lib/db/connection.postgres').checkPostgresHealth().then(console.log)"
# Esperado: { status: 'healthy', latency: <50ms }

# 2. Query test
node -e "
const { getPostgresConnection } = require('./lib/db/connection.postgres');
const db = getPostgresConnection();
db.query('SELECT COUNT(*) as count FROM users').then(console.log);
"
# Esperado: [ { count: '0' } ] ou número de usuários

# 3. Adapter test
node -e "
const db = require('./lib/db/adapter').getDatabase();
console.log('Type:', db.getType());
console.log('Async:', db.isAsync());
"
# Esperado: Type: postgresql, Async: true
```

---

## 📊 Pós-Migração (Importação de Dados)

### Backup SQLite
```bash
# 1. Exportar dados
node scripts/export-sqlite-data.js > backup.json

# 2. Verificar backup
cat backup.json | jq 'keys'
# Esperado: Array com nomes de todas as tabelas

# 3. Contar registros por tabela
cat backup.json | jq 'to_entries | map({table: .key, count: (.value | length)})'
```

### Importação
```bash
# 1. Importar dados
node scripts/import-to-postgres.js

# 2. Verificar logs
# Esperado: "Import completed!" sem erros

# 3. Validar contagens
node scripts/validate-migration.js
# Esperado: Todas as tabelas com contagens iguais
```

### Validação de Integridade
```sql
-- No PostgreSQL (psql)

-- 1. Foreign key constraints
SELECT COUNT(*) FROM information_schema.table_constraints 
WHERE constraint_type = 'FOREIGN KEY';
-- Esperado: ~50+

-- 2. Unique constraints
SELECT COUNT(*) FROM information_schema.table_constraints 
WHERE constraint_type = 'UNIQUE';
-- Esperado: ~20+

-- 3. Check constraints
SELECT COUNT(*) FROM information_schema.table_constraints 
WHERE constraint_type = 'CHECK';
-- Esperado: ~30+

-- 4. Verificar dados
SELECT 
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM tickets) as tickets,
  (SELECT COUNT(*) FROM comments) as comments,
  (SELECT COUNT(*) FROM categories) as categories,
  (SELECT COUNT(*) FROM priorities) as priorities,
  (SELECT COUNT(*) FROM statuses) as statuses;
```

---

## 🧪 Testes de Funcionalidade

### API Endpoints
```bash
# 1. Health check
curl http://localhost:3000/api/health
# Esperado: { status: 'healthy', database: 'postgresql' }

# 2. Users endpoint
curl http://localhost:3000/api/users
# Esperado: Lista de usuários

# 3. Tickets endpoint
curl http://localhost:3000/api/tickets
# Esperado: Lista de tickets
```

### Queries Complexas
```sql
-- 1. JOIN com múltiplas tabelas
SELECT 
  t.id,
  t.title,
  u.name as user_name,
  c.name as category_name,
  p.name as priority_name,
  s.name as status_name
FROM tickets t
JOIN users u ON t.user_id = u.id
JOIN categories c ON t.category_id = c.id
JOIN priorities p ON t.priority_id = p.id
JOIN statuses s ON t.status_id = s.id
LIMIT 10;
-- Esperado: Dados de 10 tickets com joins

-- 2. JSONB query
SELECT * FROM users 
WHERE metadata->>'role' = 'admin';
-- Esperado: Usuários com role=admin no metadata

-- 3. Full-text search
SELECT * FROM kb_articles 
WHERE to_tsvector('portuguese', title || ' ' || content) 
@@ to_tsquery('postgresql')
LIMIT 5;
-- Esperado: Artigos que mencionam 'postgresql'

-- 4. Analytics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_tickets,
  COUNT(CASE WHEN status_id = (SELECT id FROM statuses WHERE name = 'Resolvido') THEN 1 END) as resolved
FROM tickets
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 7;
-- Esperado: Estatísticas dos últimos 7 dias
```

### Performance
```sql
-- 1. Verificar query plan
EXPLAIN ANALYZE 
SELECT * FROM tickets 
WHERE organization_id = 1 AND status_id = 2
ORDER BY created_at DESC LIMIT 20;
-- Esperado: Index Scan (não Seq Scan), tempo < 10ms

-- 2. Verificar índices usados
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE tablename IN ('tickets', 'users', 'comments')
ORDER BY idx_scan DESC;
-- Esperado: Índices com idx_scan > 0

-- 3. Estatísticas de tabelas
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del, n_live_tup
FROM pg_stat_user_tables
WHERE tablename IN ('tickets', 'users', 'comments')
ORDER BY n_live_tup DESC;
```

---

## 🔒 Segurança

### SSL
```bash
# Verificar SSL na connection string
echo $DATABASE_URL | grep -q "sslmode=require" && echo "SSL OK" || echo "SSL MISSING"
# Esperado: SSL OK
```

### Permissões
```sql
-- Verificar permissões do usuário
SELECT grantee, privilege_type 
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' AND grantee = current_user
LIMIT 10;
-- Esperado: SELECT, INSERT, UPDATE, DELETE
```

### Auditoria
```sql
-- Verificar tabelas de auditoria
SELECT COUNT(*) FROM audit_logs;
SELECT COUNT(*) FROM auth_audit_logs;
-- Esperado: Dados de auditoria existentes
```

---

## 📈 Monitoring (Neon Dashboard)

### Métricas
- [ ] Latência de queries < 50ms (P95)
- [ ] Connection pool usage < 80%
- [ ] Storage usage dentro do limite
- [ ] Transferência de dados dentro do limite

### Alertas
- [ ] Configurar alerta de latência alta (> 100ms)
- [ ] Configurar alerta de erros (> 1%)
- [ ] Configurar alerta de storage (> 80%)

---

## 🚀 Deploy em Produção

### Pré-Deploy
- [ ] Backup completo do SQLite
- [ ] Teste de migração em staging
- [ ] Validação de integridade de dados
- [ ] Performance testing
- [ ] Rollback plan documentado

### Deploy
- [ ] Configurar DATABASE_URL no Vercel/production
- [ ] Executar migrations em produção
- [ ] Importar dados (se necessário)
- [ ] Validar health checks
- [ ] Monitorar logs de erro

### Pós-Deploy
- [ ] Verificar latência de queries
- [ ] Verificar throughput
- [ ] Verificar erros de conexão
- [ ] Configurar backups automáticos (Point-in-time recovery)
- [ ] Documentar learnings

---

## 🐛 Troubleshooting Checklist

### Erro: "DATABASE_URL not found"
- [ ] Verificar se DATABASE_URL está definida: `echo $DATABASE_URL`
- [ ] Verificar se .env.production existe
- [ ] Verificar se dotenv está carregando corretamente

### Erro: "SSL connection required"
- [ ] Adicionar `?sslmode=require` na DATABASE_URL
- [ ] Verificar se SSL está habilitado no Neon

### Erro: "Migration failed"
- [ ] Verificar status: `npm run migrate:status`
- [ ] Ver logs de erro na tabela `schema_migrations`
- [ ] Rollback e tentar novamente: `npm run migrate:rollback && npm run migrate`

### Erro: "Syntax error near ?"
- [ ] Verificar se está usando o adapter (não conexão direta)
- [ ] Verificar se placeholders estão sendo convertidos (? → $1)

### Performance lenta
- [ ] Verificar query plan: `EXPLAIN ANALYZE <query>`
- [ ] Verificar se índices estão sendo usados
- [ ] Verificar connection pool size
- [ ] Verificar latência no Neon dashboard

---

## ✅ Checklist Final

Antes de considerar migração completa:

### Funcionalidade
- [ ] Login funciona
- [ ] Criação de tickets funciona
- [ ] Listagem de tickets funciona
- [ ] Busca de tickets funciona
- [ ] Comentários funcionam
- [ ] Anexos funcionam
- [ ] Notificações funcionam
- [ ] Analytics funcionam
- [ ] Knowledge base funciona

### Performance
- [ ] Latência < 100ms (P95)
- [ ] Throughput > 100 req/s
- [ ] Connection pool stable
- [ ] Sem memory leaks

### Segurança
- [ ] SSL habilitado
- [ ] Credenciais rotacionadas
- [ ] Auditoria funcionando
- [ ] Rate limiting ativo

### Monitoring
- [ ] Sentry configurado
- [ ] Logs funcionando
- [ ] Alertas configurados
- [ ] Dashboards atualizados

---

## 🎉 Migração Completa!

Se todos os checkboxes estão marcados, a migração foi bem-sucedida! 🚀

**Próximo passo**: Monitorar produção por 7 dias e otimizar conforme necessário.
