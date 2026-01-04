# 🚀 SEED DATA - QUICK START GUIDE

## Resetar e Repopular Database

### Opção 1: Comando Único (Recomendado)
```bash
npm run db:clear && npm run init-db
```

### Opção 2: Passo a Passo
```bash
# 1. Limpar dados existentes
npm run db:clear

# 2. Recriar schema e inserir seed data
npm run init-db

# 3. Validar (opcional)
npx tsx scripts/validate-seed.ts
```

---

## 🔑 Credenciais de Login

### Admin (Acesso Total)
```
Email: admin@servicedesk.com
Senha: 123456
```

### Agentes de Suporte
```
joao.silva@servicedesk.com   / 123456  (9 tickets)
maria.santos@servicedesk.com / 123456  (7 tickets)
pedro.costa@servicedesk.com  / 123456  (6 tickets)
```

### Usuários Finais
```
ana.oliveira@servicedesk.com / 123456
carlos.ferreira@servicedesk.com / 123456
lucia.rodrigues@servicedesk.com / 123456
teste@servicedesk.com / 123456
```

---

## 📊 O Que Foi Criado

```
✅ 11 Usuários (1 admin + 3 agentes + 7 users)
✅ 6 Categorias (Suporte, Solicitação, Bug, Dúvida, Acesso, Outros)
✅ 4 Prioridades (Baixa, Média, Alta, Crítica)
✅ 7 Status (Novo, Em Andamento, Aguardando, Resolvido, Fechado, Cancelado)
✅ 30 Tickets (diversos cenários realísticos)
✅ 48 Comentários (interações entre usuários e agentes)
✅ 10 Artigos de Knowledge Base (6,870 views totais)
✅ 5 Políticas de SLA (15min até 48h)
✅ 3 Templates de Tickets
✅ 3 Automações Ativas
✅ 15 Configurações de Sistema
```

---

## 🎯 Cenários Demonstráveis

### Dashboard
- Tickets por status (gráfico pizza)
- Tickets por prioridade (gráfico barras)
- Atividade recente
- SLA compliance

### Tickets Críticos
- **Sistema de pagamento fora do ar** (4 comentários)
- **Servidor com alta latência** (3 comentários)

### Base de Conhecimento
- **VPN Corporativa** (1,234 views)
- **Email no Mobile** (1,045 views)
- **Trabalho Remoto** (956 views)

---

## 📈 Estatísticas

### Distribuição de Tickets
```
Status:
  Novo: 11 (37%)
  Em Andamento: 8 (27%)
  Aguardando: 4 (13%)
  Resolvido: 4 (13%)
  Fechado: 3 (10%)

Prioridade:
  Crítica: 2 (7%)
  Alta: 6 (20%)
  Média: 11 (37%)
  Baixa: 11 (37%)

Categoria:
  Suporte Técnico: 10 (33%)
  Solicitação: 7 (23%)
  Bug Report: 6 (20%)
  Acesso: 4 (13%)
```

### Carga de Trabalho
```
João Silva: 9 tickets
Maria Santos: 7 tickets
Pedro Costa: 6 tickets
```

---

## 🔍 Validar Seed Data

```bash
npx tsx scripts/validate-seed.ts
```

Mostra:
- Tickets por status/prioridade/categoria
- Top 5 artigos KB
- Top 5 tickets com mais interação
- Carga de trabalho dos agentes
- Resumo geral

---

## 📝 Relatório Completo

Ver: `AGENT_30_SEED_DATA_REPORT.md`

---

## 🎉 Pronto para Demonstração!

**Executar:**
```bash
npm run dev
```

**Acessar:**
```
http://localhost:3000
```

**Login:**
```
admin@servicedesk.com / 123456
```

---

**Agent 30 - Seed Data Complete**
**Sistema 100% populado e pronto!** 🚀
