#!/usr/bin/env tsx

import { getDb } from '../lib/db'
import { logger } from '@/lib/monitoring/logger';

/**
 * Script para popular a base de conhecimento com dados de exemplo
 */
function seedKnowledgeBase() {
  const db = getDb()

  try {
    logger.info('🌱 Populando base de conhecimento...')

    // Inserir categorias
    const categories = [
      {
        name: 'Problemas Comuns',
        slug: 'problemas-comuns',
        description: 'Soluções para problemas frequentes encontrados pelos usuários',
        icon: 'ExclamationTriangleIcon',
        color: '#F59E0B'
      },
      {
        name: 'Configurações',
        slug: 'configuracoes',
        description: 'Guias de configuração do sistema e funcionalidades',
        icon: 'CogIcon',
        color: '#6366F1'
      },
      {
        name: 'Procedimentos',
        slug: 'procedimentos',
        description: 'Procedimentos operacionais padrão e workflows',
        icon: 'DocumentTextIcon',
        color: '#10B981'
      },
      {
        name: 'FAQ',
        slug: 'faq',
        description: 'Perguntas frequentes e respostas rápidas',
        icon: 'QuestionMarkCircleIcon',
        color: '#EC4899'
      },
      {
        name: 'Tutoriais',
        slug: 'tutoriais',
        description: 'Guias passo a passo para usar o sistema',
        icon: 'AcademicCapIcon',
        color: '#8B5CF6'
      }
    ]

    for (const category of categories) {
      db.prepare(`
        INSERT OR IGNORE INTO kb_categories (name, slug, description, icon, color)
        VALUES (?, ?, ?, ?, ?)
      `).run(category.name, category.slug, category.description, category.icon, category.color)
    }

    // Buscar IDs das categorias criadas
    const categoryIds = db.prepare('SELECT id, slug FROM kb_categories').all()
    const categoryMap = Object.fromEntries(categoryIds.map((cat: any) => [cat.slug, cat.id]))

    // Inserir artigos
    const articles = [
      {
        title: 'Como resetar sua senha',
        slug: 'como-resetar-sua-senha',
        summary: 'Aprenda a redefinir sua senha de acesso ao sistema de forma segura.',
        content: `
          <h2>Resetando sua senha</h2>
          <p>Se você esqueceu sua senha, siga estes passos simples para redefini-la:</p>

          <h3>Passo 1: Acesse a página de login</h3>
          <p>Vá para a página de login do sistema e clique em "Esqueci minha senha".</p>

          <h3>Passo 2: Digite seu email</h3>
          <p>Insira o endereço de email associado à sua conta.</p>

          <h3>Passo 3: Verifique seu email</h3>
          <p>Você receberá um email com um link para redefinir sua senha. Clique no link.</p>

          <h3>Passo 4: Crie uma nova senha</h3>
          <p>Digite uma nova senha forte que contenha pelo menos 8 caracteres, incluindo letras, números e símbolos.</p>

          <h3>Dicas de segurança</h3>
          <ul>
            <li>Use uma senha única para cada conta</li>
            <li>Não compartilhe sua senha com ninguém</li>
            <li>Considere usar um gerenciador de senhas</li>
          </ul>
        `,
        category_id: categoryMap['faq'],
        search_keywords: 'senha, reset, redefinir, login, acesso, esqueci',
        featured: true,
        status: 'published'
      },
      {
        title: 'Como criar um ticket de suporte',
        slug: 'como-criar-ticket-suporte',
        summary: 'Guia completo para criar e gerenciar tickets de suporte no sistema.',
        content: `
          <h2>Criando um ticket de suporte</h2>
          <p>Para solicitar ajuda ou reportar um problema, você pode criar um ticket de suporte:</p>

          <h3>1. Acessando o sistema</h3>
          <p>Faça login no sistema com suas credenciais.</p>

          <h3>2. Navegando para tickets</h3>
          <p>No menu principal, clique em "Tickets" ou "Suporte".</p>

          <h3>3. Criando um novo ticket</h3>
          <p>Clique no botão "Novo Ticket" e preencha as informações:</p>
          <ul>
            <li><strong>Título:</strong> Descreva brevemente o problema</li>
            <li><strong>Categoria:</strong> Selecione a categoria mais apropriada</li>
            <li><strong>Prioridade:</strong> Indique a urgência do problema</li>
            <li><strong>Descrição:</strong> Detalhe o problema ou solicitação</li>
          </ul>

          <h3>4. Anexando arquivos</h3>
          <p>Se necessário, anexe capturas de tela ou documentos que ajudem a explicar o problema.</p>

          <h3>5. Acompanhando o ticket</h3>
          <p>Após criar o ticket, você receberá um número de identificação e poderá acompanhar o progresso.</p>
        `,
        category_id: categoryMap['tutoriais'],
        search_keywords: 'ticket, suporte, criar, novo, ajuda, problema',
        featured: true,
        status: 'published'
      },
      {
        title: 'Configurando notificações por email',
        slug: 'configurando-notificacoes-email',
        summary: 'Aprenda a personalizar suas preferências de notificação por email.',
        content: `
          <h2>Configuração de notificações</h2>
          <p>Você pode personalizar quando e como receber notificações por email:</p>

          <h3>Acessando as configurações</h3>
          <ol>
            <li>Clique no seu avatar no canto superior direito</li>
            <li>Selecione "Configurações" ou "Perfil"</li>
            <li>Navegue até a aba "Notificações"</li>
          </ol>

          <h3>Tipos de notificação</h3>
          <ul>
            <li><strong>Novos tickets:</strong> Quando um ticket é atribuído a você</li>
            <li><strong>Atualizações:</strong> Quando há novos comentários em seus tickets</li>
            <li><strong>Lembretes:</strong> Para tickets próximos do vencimento</li>
            <li><strong>Resumos:</strong> Relatórios diários ou semanais</li>
          </ul>

          <h3>Configurações avançadas</h3>
          <p>Você também pode configurar:</p>
          <ul>
            <li>Horário para envio de notificações</li>
            <li>Frequência dos resumos</li>
            <li>Filtros por categoria ou prioridade</li>
          </ul>
        `,
        category_id: categoryMap['configuracoes'],
        search_keywords: 'notificações, email, configurar, preferências',
        status: 'published'
      },
      {
        title: 'Resolvendo problemas de login',
        slug: 'resolvendo-problemas-login',
        summary: 'Soluções para os problemas mais comuns ao fazer login no sistema.',
        content: `
          <h2>Problemas comuns de login</h2>
          <p>Se você está tendo dificuldades para fazer login, tente estas soluções:</p>

          <h3>Senha incorreta</h3>
          <ul>
            <li>Verifique se o Caps Lock está desligado</li>
            <li>Tente digitar a senha em um editor de texto primeiro</li>
            <li>Use a opção "Mostrar senha" se disponível</li>
            <li>Se ainda não funcionar, use "Esqueci minha senha"</li>
          </ul>

          <h3>Conta bloqueada</h3>
          <p>Após várias tentativas incorretas, sua conta pode ser temporariamente bloqueada.</p>
          <ul>
            <li>Aguarde 15 minutos antes de tentar novamente</li>
            <li>Entre em contato com o suporte se o problema persistir</li>
          </ul>

          <h3>Problemas no navegador</h3>
          <ul>
            <li>Limpe cookies e cache do navegador</li>
            <li>Desative extensões temporariamente</li>
            <li>Tente um navegador diferente</li>
            <li>Verifique se JavaScript está habilitado</li>
          </ul>

          <h3>Outros problemas</h3>
          <ul>
            <li>Verifique sua conexão com a internet</li>
            <li>Confirme se está usando a URL correta</li>
            <li>Tente acessar de outro dispositivo</li>
          </ul>
        `,
        category_id: categoryMap['problemas-comuns'],
        search_keywords: 'login, problema, senha, bloqueado, acesso',
        status: 'published'
      },
      {
        title: 'Procedimento para escalação de tickets',
        slug: 'procedimento-escalacao-tickets',
        summary: 'Quando e como escalar tickets para níveis superiores de suporte.',
        content: `
          <h2>Escalação de tickets</h2>
          <p>Este procedimento define quando e como escalar tickets que requerem atenção especializada.</p>

          <h3>Critérios para escalação</h3>
          <h4>Escalação por tempo (SLA)</h4>
          <ul>
            <li>Prioridade Alta: 2 horas sem resposta</li>
            <li>Prioridade Média: 8 horas sem resposta</li>
            <li>Prioridade Baixa: 24 horas sem resposta</li>
          </ul>

          <h4>Escalação por complexidade</h4>
          <ul>
            <li>Problemas técnicos complexos</li>
            <li>Questões que requerem acesso administrativo</li>
            <li>Solicitações de mudança no sistema</li>
            <li>Problemas de segurança</li>
          </ul>

          <h3>Processo de escalação</h3>
          <ol>
            <li><strong>Avaliar:</strong> Confirme se a escalação é necessária</li>
            <li><strong>Documentar:</strong> Adicione todas as informações relevantes</li>
            <li><strong>Categorizar:</strong> Defina o motivo da escalação</li>
            <li><strong>Atribuir:</strong> Mova para a equipe apropriada</li>
            <li><strong>Notificar:</strong> Informe o cliente sobre a escalação</li>
          </ol>

          <h3>Níveis de escalação</h3>
          <ul>
            <li><strong>Nível 2:</strong> Suporte técnico especializado</li>
            <li><strong>Nível 3:</strong> Engenharia/Desenvolvimento</li>
            <li><strong>Gerencial:</strong> Para questões contratuais ou políticas</li>
          </ul>
        `,
        category_id: categoryMap['procedimentos'],
        search_keywords: 'escalação, escalacao, procedimento, sla, nivel',
        status: 'published'
      }
    ]

    // Buscar usuário admin para ser o autor
    const adminUser = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get()
    const authorId = adminUser ? adminUser.id : 1

    for (const article of articles) {
      const result = db.prepare(`
        INSERT OR IGNORE INTO kb_articles (
          title, slug, summary, content, category_id, author_id,
          search_keywords, featured, status, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        article.title,
        article.slug,
        article.summary,
        article.content,
        article.category_id,
        authorId,
        article.search_keywords,
        article.featured ? 1 : 0,
        article.status
      )

      if (result.changes > 0) {
        logger.info(`✅ Artigo criado: ${article.title}`)
      }
    }

    // Inserir algumas tags e associá-las aos artigos
    const tags = [
      { name: 'Senha', slug: 'senha' },
      { name: 'Login', slug: 'login' },
      { name: 'Ticket', slug: 'ticket' },
      { name: 'Suporte', slug: 'suporte' },
      { name: 'Configuração', slug: 'configuracao' },
      { name: 'Email', slug: 'email' },
      { name: 'Problema', slug: 'problema' },
      { name: 'Tutorial', slug: 'tutorial' },
      { name: 'Procedimento', slug: 'procedimento' },
      { name: 'SLA', slug: 'sla' }
    ]

    for (const tag of tags) {
      db.prepare(`
        INSERT OR IGNORE INTO kb_tags (name, slug)
        VALUES (?, ?)
      `).run(tag.name, tag.slug)
    }

    logger.info('✅ Base de conhecimento populada com sucesso!')
    logger.info('📊 Estatísticas')

    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM kb_categories').get()
    const articleCount = db.prepare('SELECT COUNT(*) as count FROM kb_articles').get()
    const tagCount = db.prepare('SELECT COUNT(*) as count FROM kb_tags').get()

    logger.info(`   - ${categoryCount.count} categorias`)
    logger.info(`   - ${articleCount.count} artigos`)
    logger.info(`   - ${tagCount.count} tags`)

  } catch (error) {
    logger.error('❌ Erro ao popular base de conhecimento', error)
    throw error
  }
}

// Executar se este arquivo for executado diretamente
if (require.main === module) {
  seedKnowledgeBase()
}

export { seedKnowledgeBase }