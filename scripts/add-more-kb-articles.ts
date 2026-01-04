#!/usr/bin/env tsx

import { getDb } from '../lib/db'
import { logger } from '@/lib/monitoring/logger';

/**
 * Script para adicionar mais 5 artigos à base de conhecimento
 */
function addMoreArticles() {
  const db = getDb()

  try {
    logger.info('🌱 Adicionando mais artigos à base de conhecimento...')

    // Buscar categorias existentes
    const categories = db.prepare('SELECT id, slug FROM kb_categories').all() as Array<{ id: number; slug: string }>

    if (categories.length === 0) {
      logger.error('Nenhuma categoria encontrada. Execute o seed-knowledge-base.ts primeiro.')
      return
    }

    // Buscar o admin user
    const adminUser = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin') as { id: number } | undefined

    if (!adminUser) {
      logger.error('Nenhum usuário admin encontrado.')
      return
    }

    // Artigos adicionais
    const articles = [
      {
        title: 'Gerenciando SLAs e Prioridades',
        slug: 'gerenciando-slas-prioridades',
        summary: 'Entenda como funcionam os SLAs e como definir prioridades para seus tickets',
        content: `
# Gerenciando SLAs e Prioridades

## O que é SLA?

SLA (Service Level Agreement) é um acordo de nível de serviço que define prazos para resolução de tickets.

## Níveis de Prioridade

### Crítica
- Impacto: Sistema completamente fora do ar
- Tempo de resposta: 15 minutos
- Tempo de resolução: 4 horas

### Alta
- Impacto: Funcionalidade importante indisponível
- Tempo de resposta: 1 hora
- Tempo de resolução: 8 horas

### Média
- Impacto: Funcionalidade com restrições
- Tempo de resposta: 4 horas
- Tempo de resolução: 24 horas

### Baixa
- Impacto: Questões menores ou dúvidas
- Tempo de resposta: 8 horas
- Tempo de resolução: 72 horas

## Como Definir a Prioridade

1. Avalie o impacto no negócio
2. Considere o número de usuários afetados
3. Verifique se há workaround disponível
4. Siga as diretrizes da sua organização
        `,
        category_slug: 'procedimentos',
        featured: true,
        search_keywords: 'sla, prioridade, prazo, acordo, tempo resposta'
      },
      {
        title: 'Integração com WhatsApp Business',
        slug: 'integracao-whatsapp-business',
        summary: 'Configure a integração com WhatsApp para receber e responder tickets via mensagem',
        content: `
# Integração com WhatsApp Business

## Requisitos

- Conta WhatsApp Business verificada
- API Key do WhatsApp Business
- Webhook URL configurado

## Configuração Passo a Passo

### 1. Obter Credenciais

1. Acesse o Facebook Business Manager
2. Navegue até WhatsApp Business API
3. Copie seu API Key e Phone Number ID

### 2. Configurar no ServiceDesk

1. Vá em Configurações > Integrações
2. Selecione "WhatsApp Business"
3. Cole suas credenciais
4. Configure a URL do webhook: \`https://seu-dominio.com/api/integrations/whatsapp/webhook\`

### 3. Testar a Integração

1. Envie uma mensagem de teste
2. Verifique se um ticket foi criado automaticamente
3. Responda o ticket e confirme que a resposta foi enviada

## Recursos

- Criação automática de tickets
- Respostas automáticas
- Anexos de mídia
- Status de leitura
        `,
        category_slug: 'configuracoes',
        featured: false,
        search_keywords: 'whatsapp, integracao, mensagem, api, webhook'
      },
      {
        title: 'Melhores Práticas de Atendimento',
        slug: 'melhores-praticas-atendimento',
        summary: 'Guia completo com as melhores práticas para oferecer um atendimento de excelência',
        content: `
# Melhores Práticas de Atendimento

## Comunicação Efetiva

### Seja Claro e Objetivo
- Use linguagem simples e direta
- Evite jargões técnicos desnecessários
- Confirme o entendimento do usuário

### Demonstre Empatia
- Reconheça a frustração do usuário
- Use tom amigável e profissional
- Personalize o atendimento

## Gestão de Tempo

### Priorize Adequadamente
1. Tickets críticos primeiro
2. Respeite os SLAs
3. Gerencie expectativas

### Seja Proativo
- Atualize o usuário sobre o progresso
- Não espere que o usuário cobre
- Previna problemas futuros

## Resolução de Problemas

### Processo em 5 Etapas
1. **Entenda** o problema completamente
2. **Investigue** as possíveis causas
3. **Teste** soluções em ambiente seguro
4. **Implemente** a correção
5. **Documente** para referência futura

## Fechamento

- Confirme que o problema foi resolvido
- Pergunte se há algo mais a fazer
- Agradeça pela paciência
- Solicite feedback
        `,
        category_slug: 'tutoriais',
        featured: true,
        search_keywords: 'atendimento, boas praticas, qualidade, suporte, excelencia'
      },
      {
        title: 'Usando a Base de Conhecimento',
        slug: 'usando-base-conhecimento',
        summary: 'Aprenda a usar a base de conhecimento para encontrar soluções rapidamente',
        content: `
# Usando a Base de Conhecimento

## O que é a Base de Conhecimento?

A Base de Conhecimento (KB) é um repositório centralizado de artigos, tutoriais e soluções para problemas comuns.

## Como Buscar

### Busca Rápida
1. Use a barra de pesquisa no topo
2. Digite palavras-chave relacionadas ao seu problema
3. Pressione Enter ou clique na lupa

### Busca por Categoria
1. Navegue pelas categorias no menu lateral
2. Clique na categoria desejada
3. Explore os artigos disponíveis

### Filtros Avançados
- Por relevância
- Por data de publicação
- Por popularidade (mais visualizados)
- Por taxa de utilidade

## Avaliando Artigos

### Foi Útil?
Ao final de cada artigo, você pode avaliar:
- 👍 Sim, foi útil
- 👎 Não foi útil

### Deixe um Comentário
Se o artigo não resolveu seu problema:
1. Clique em "Não foi útil"
2. Descreva o que está faltando
3. Nossa equipe usará seu feedback para melhorar

## Dicas

- Favorite artigos úteis para acesso rápido
- Compartilhe artigos com colegas
- Sugira novos tópicos para nossa equipe
        `,
        category_slug: 'tutoriais',
        featured: false,
        search_keywords: 'base conhecimento, kb, busca, pesquisa, artigos'
      },
      {
        title: 'Perguntas Frequentes - Portal do Usuário',
        slug: 'faq-portal-usuario',
        summary: 'Respostas para as perguntas mais comuns sobre o portal do usuário',
        content: `
# FAQ - Portal do Usuário

## Acesso e Autenticação

### Como faço para acessar o portal?
Acesse o endereço do portal e faça login com seu email corporativo e senha.

### Esqueci minha senha. E agora?
1. Clique em "Esqueci minha senha" na tela de login
2. Digite seu email
3. Verifique sua caixa de entrada
4. Clique no link recebido
5. Defina uma nova senha

### Posso usar autenticação via GOV.BR?
Sim! Se sua organização habilitou essa opção, você verá o botão "Entrar com GOV.BR" na tela de login.

## Tickets

### Como abrir um ticket?
1. Faça login no portal
2. Clique em "Novo Ticket"
3. Preencha o formulário
4. Anexe arquivos se necessário
5. Clique em "Enviar"

### Posso acompanhar meus tickets?
Sim! Acesse "Meus Tickets" no menu para ver todos os tickets que você abriu, seu status e histórico.

### Quanto tempo leva para resposta?
Depende da prioridade do seu ticket:
- Crítica: até 15 minutos
- Alta: até 1 hora
- Média: até 4 horas
- Baixa: até 8 horas

## Catálogo de Serviços

### O que é o catálogo de serviços?
É um menu de solicitações pré-definidas que você pode fazer sem precisar preencher um ticket do zero.

### Como solicitar um serviço?
1. Vá em "Catálogo de Serviços"
2. Escolha o serviço desejado
3. Preencha os campos obrigatórios
4. Envie a solicitação

## Notificações

### Como recebo atualizações dos meus tickets?
Por padrão, você recebe emails quando:
- Seu ticket recebe uma resposta
- Status do ticket muda
- Ticket é resolvido

### Posso desativar notificações por email?
Sim! Vá em "Perfil" > "Notificações" e ajuste suas preferências.
        `,
        category_slug: 'faq',
        featured: false,
        search_keywords: 'faq, perguntas frequentes, duvidas, portal, usuario'
      }
    ]

    // Inserir artigos
    for (const article of articles) {
      const category = categories.find(c => c.slug === article.category_slug)
      if (!category) {
        logger.warn(`Categoria ${article.category_slug} não encontrada. Pulando artigo: ${article.title}`)
        continue
      }

      const result = db.prepare(`
        INSERT INTO kb_articles (
          title, slug, summary, content, category_id, author_id,
          status, visibility, featured, search_keywords, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        article.title,
        article.slug,
        article.summary,
        article.content,
        category.id,
        adminUser.id,
        'published',
        'public',
        article.featured ? 1 : 0,
        article.search_keywords
      )

      logger.info(`✅ Artigo criado: ${article.title}`)
    }

    // Verificar total
    const totalArticles = db.prepare('SELECT COUNT(*) as count FROM kb_articles').get() as { count: number }
    logger.info(`✅ Total de artigos na base: ${totalArticles.count}`)

  } catch (error) {
    logger.error('Erro ao adicionar artigos:', error)
  }
}

addMoreArticles()
