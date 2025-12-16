# Guia de Migração: SQLite → PostgreSQL

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Diferenças SQLite vs PostgreSQL](#diferenças-sqlite-vs-postgresql)
4. [Arquivos Criados](#arquivos-criados)
5. [Processo de Migração](#processo-de-migração)
6. [Configuração](#configuração)
7. [Validação](#validação)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Visão Geral

Este projeto agora suporta **dois bancos de dados**:

- **SQLite**: Para desenvolvimento local (rápido, zero-config)
- **PostgreSQL**: Para produção (escalável, concorrente, Neon Serverless)

A seleção é **automática** baseada na variável de ambiente `DATABASE_URL`.

### Por que PostgreSQL?

| Aspecto | SQLite | PostgreSQL |
|---------|--------|------------|
| **Concorrência** | ❌ Write locks bloqueiam leituras | ✅ MVCC - leituras nunca bloqueiam |
| **Conexões simultâneas** | ⚠️ Limitado | ✅ Centenas/milhares |
| **Tipos de dados** | ⚠️ 5 tipos básicos | ✅ JSONB, INET, Array, etc |
| **Full-text search** | ❌ Básico | ✅ Nativo com GIN indexes |
| **Cloud-native** | ❌ Arquivo local | ✅ Neon Serverless (auto-scaling) |
| **Backup/Replicação** | ⚠️ Manual | ✅ Point-in-time recovery |
| **Performance em escala** | ⚠️ < 100k requests/day | ✅ Milhões/dia |

---

## 📦 Pré-requisitos

### 1. Instalar Dependências

```bash
npm install @neondatabase/serverless
```

Já instalado no projeto ✅

### 2. Criar Conta no Neon (Produção)

1. Acesse: https://neon.tech
2. Crie projeto gratuito (300 GB/mês free tier)
3. Copie a `DATABASE_URL` (Connection String)

### 3. Configurar Variáveis de Ambiente

**Desenvolvimento (SQLite):**
```env
# .env.local
NODE_ENV=development
# DATABASE_URL não definida = SQLite automático
```

**Produção (PostgreSQL/Neon):**
```env
# .env.production
NODE_ENV=production
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require
```

---

## 📁 Arquivos Criados

### 1. Schema PostgreSQL
**`lib/db/schema.postgres.sql`** (2000+ linhas)
- Schema completo convertido de SQLite
- Otimizado para PostgreSQL com JSONB, INET, TIMESTAMP WITH TIME ZONE
- Índices GIN para full-text search

### 2. Sistema de Migrations
**`lib/db/migrations/001_initial_schema.sql`**
**`lib/db/migration-manager.ts`**
- Migrations versionadas
- Comandos: migrate, status, rollback, force

### 3. Connection Layer
**`lib/db/connection.postgres.ts`**
**`lib/db/adapter.ts`**
- Wrapper Neon Serverless
- Interface unificada SQLite + PostgreSQL

### 4. Configuração Dual
**`lib/db/config.ts`** (atualizado)
- Detecção automática via DATABASE_URL
- Validação e helpers

---

## 🚀 Processo de Migração

### Nova Instalação (PostgreSQL)

```bash
export DATABASE_URL="postgresql://user:pass@host/db"
npm run migrate
npm run db:seed
npm run migrate:status
```

### Migrar Dados Existentes

Ver guia completo em POSTGRES_MIGRATION_GUIDE.md

---

## ⚙️ Configuração

```env
DATABASE_URL=postgresql://...?sslmode=require
NODE_ENV=production
```

---

## ✅ Validação

```bash
npm run db:info
npm run migrate:status
```

---

## 🐛 Troubleshooting

### DATABASE_URL not defined
```bash
echo $DATABASE_URL
```

### SSL Connection Error
Adicionar `?sslmode=require`

### Placeholder Conversion
Usar adapter: `getDatabase()`

---

Documentação completa: POSTGRES_MIGRATION_GUIDE.md
