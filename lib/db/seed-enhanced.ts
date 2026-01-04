import db from './connection';
import logger from '../monitoring/structured-logger';

/**
 * Enhanced seed data for dashboard with realistic dates and analytics
 * This script adds 50+ tickets spanning 30 days with varied statuses
 */
export async function seedEnhancedData() {
  try {
    logger.info('🌱 Seeding enhanced demo data for dashboard...');

    // Helper to generate dates N days ago
    const getDaysAgo = (days: number): string => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date.toISOString().split('T')[0] + ' ' + date.toTimeString().split(' ')[0];
    };

    // Check if we already have sufficient analytics data
    const metricsCount = db.prepare('SELECT COUNT(*) as count FROM analytics_daily_metrics').get() as { count: number };
    if (metricsCount.count >= 30) {
      logger.info('✅ Database already has sufficient analytics data (30+ days), skipping enhanced seed');
      return true;
    } else if (metricsCount.count > 0) {
      logger.info(`📊 Found ${metricsCount.count} existing analytics records, will add missing days...`);
    }

    // Get current ticket count to determine if we need to add more tickets
    const ticketCount = db.prepare('SELECT COUNT(*) as count FROM tickets').get() as { count: number };
    const shouldAddTickets = ticketCount.count < 50;

    // Enhanced ticket insertion with dates
    const insertTicket = db.prepare(`
      INSERT INTO tickets (title, description, user_id, assigned_to, category_id, priority_id, status_id, created_at, updated_at, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const enhancedTickets = [
      // === DAY 0 - TODAY (Urgent/Recent) ===
      ['Sistema de pagamento fora do ar AGORA', 'Gateway de pagamento retornando erro 503. Clientes não conseguem finalizar compras. CRÍTICO - Perda de receita estimada: R$ 50k/hora!', 6, 2, 1, 4, 2, getDaysAgo(0), getDaysAgo(0)],
      ['Banco de dados com 98% de disco cheio', 'Servidor principal de produção com disco quase cheio. Sistema pode parar a qualquer momento!', 5, 2, 1, 4, 2, getDaysAgo(0), getDaysAgo(0)],
      ['API de autenticação retornando 500', 'Endpoint /api/auth/login falhando intermitentemente. Taxa de erro: 45%.', 7, 2, 3, 4, 1, getDaysAgo(0), getDaysAgo(0)],

      // === DAY 1 - YESTERDAY ===
      ['Servidor de produção com alta latência', 'Latência média subiu de 200ms para 5 segundos. Todos os usuários impactados.', 5, 2, 1, 4, 2, getDaysAgo(1), getDaysAgo(1)],
      ['Vazamento de memória no módulo de vendas', 'Aplicação consumindo 95% da RAM após 2 horas. Requer restart a cada 3 horas.', 6, 2, 3, 3, 2, getDaysAgo(1), getDaysAgo(1)],
      ['Integração SAP ERP falhando', 'Sincronização com SAP parou. 145 pedidos aguardando exportação.', 5, 3, 1, 3, 2, getDaysAgo(1), getDaysAgo(1)],
      ['SSL certificado vai expirar em 5 dias', 'Certificado do domínio principal expira em breve. Renovação urgente necessária.', 6, 2, 1, 3, 1, getDaysAgo(1), getDaysAgo(1)],

      // === DAYS 2-3 ===
      ['Erro na impressão de relatórios financeiros', 'Sistema apresenta erro 500 ao gerar PDFs de relatórios mensais.', 7, 4, 3, 3, 2, getDaysAgo(2), getDaysAgo(2)],
      ['Falha no backup automático há 3 dias', 'Sistema de backup não executa. Último backup: 72h atrás. CRÍTICO!', 7, 4, 1, 4, 2, getDaysAgo(2), getDaysAgo(2)],
      ['Performance degradada em horário de pico', 'Sistema muito lento entre 14h-16h. Timeout em 60% das requisições.', 8, 2, 1, 3, 2, getDaysAgo(3), getDaysAgo(3)],
      ['Webhook de integração retornando 401', 'Integração com sistema de pagamento falhando com erro de autenticação.', 6, 3, 1, 2, 2, getDaysAgo(3), getDaysAgo(3)],

      // === DAYS 4-7 (THIS WEEK) ===
      ['Problema com login no sistema', 'Erro "credenciais inválidas" mesmo com senha correta. Afeta 15+ usuários.', 5, 2, 1, 2, 2, getDaysAgo(4), getDaysAgo(4)],
      ['Dashboard não carrega gráficos', 'Gráficos do admin não aparecem. Console mostra erro CORS.', 6, 3, 3, 2, 3, getDaysAgo(4), getDaysAgo(4)],
      ['Lentidão no módulo de relatórios', 'Relatórios customizados demorando 2+ minutos. Antes: 5 segundos.', 7, 2, 1, 2, 2, getDaysAgo(5), getDaysAgo(5)],
      ['Erro ao exportar para Excel', 'Exportação retorna arquivo corrompido. Caracteres especiais quebrados.', 6, 4, 3, 2, 5, getDaysAgo(5), getDaysAgo(5)],
      ['Notificações por email não chegando', 'Emails de notificação não sendo enviados há 2 dias.', 7, 2, 1, 2, 2, getDaysAgo(6), getDaysAgo(6)],
      ['Campo de data não aceita formato BR', 'Formulário só aceita MM/DD/YYYY. Usuários BR precisam DD/MM/YYYY.', 5, 4, 3, 2, 5, getDaysAgo(6), getDaysAgo(6)],
      ['Timeout em consultas SQL complexas', 'Relatórios com 6+ meses de dados retornam timeout.', 6, 2, 1, 2, 2, getDaysAgo(7), getDaysAgo(7)],
      ['Cache Redis não invalidando', 'Dados antigos persistindo em cache após atualização no banco.', 5, 2, 3, 3, 6, getDaysAgo(7), getDaysAgo(7)],

      // === DAYS 8-14 (LAST WEEK) ===
      ['Solicitação de novo usuário - Vendas', 'Criar usuário: Roberto Lima (roberto.lima@empresa.com) - Depto Vendas', 6, 3, 5, 1, 6, getDaysAgo(8), getDaysAgo(8)],
      ['Dúvida sobre funcionalidade de exportação', 'Como exportar dados de tickets para análise? Existe tutorial?', 5, 4, 4, 1, 6, getDaysAgo(9), getDaysAgo(9)],
      ['Alterar email cadastrado', 'Mudei de departamento. Atualizar de joao.antigo@ para joao.novo@empresa.com', 8, 3, 2, 1, 6, getDaysAgo(10), getDaysAgo(10)],
      ['Treinamento - Sistema CRM', 'Equipe de 5 pessoas precisa treinamento no novo CRM.', 6, 3, 2, 1, 3, getDaysAgo(10), getDaysAgo(10)],
      ['Acesso VPN para home office', 'Configurar VPN para trabalho remoto. Depto Financeiro.', 7, 2, 5, 1, 6, getDaysAgo(11), getDaysAgo(11)],
      ['Como criar relatórios customizados?', 'Preciso aprender a criar relatórios personalizados. Tem docs?', 5, 4, 4, 1, 6, getDaysAgo(12), getDaysAgo(12)],
      ['Assinatura de email corporativa', 'Configurar assinatura padrão da empresa no Outlook.', 6, 3, 2, 1, 6, getDaysAgo(13), getDaysAgo(13)],
      ['Instalação Office 365', 'Instalar pacote Office 365 na estação de trabalho.', 8, 2, 2, 1, 6, getDaysAgo(14), getDaysAgo(14)],

      // === DAYS 15-21 ===
      ['Reset de senha - Conta bloqueada', 'Conta bloqueada após 3 tentativas incorretas. Desbloquear urgente.', 5, 2, 5, 2, 6, getDaysAgo(15), getDaysAgo(15)],
      ['Configuração impressora de rede', 'Nova HP no 3º andar. Configurar para todos do departamento.', 7, 4, 1, 1, 6, getDaysAgo(16), getDaysAgo(16)],
      ['Solicitação licença AutoCAD 2024', 'Necessito licença AutoCAD para projeto de engenharia.', 6, 3, 2, 2, 6, getDaysAgo(17), getDaysAgo(17)],
      ['Migração dados para novo servidor', 'Transferir DB de clientes para PostgreSQL v15.', 5, 2, 1, 3, 6, getDaysAgo(18), getDaysAgo(18)],
      ['Erro 404 na página de produtos', 'Rota /produtos/categoria/eletronicos retorna 404.', 6, 4, 3, 3, 6, getDaysAgo(19), getDaysAgo(19)],
      ['Aumento de cota de storage', 'Cota de 50GB está 98% cheia. Preciso mais 50GB.', 7, 2, 2, 1, 6, getDaysAgo(20), getDaysAgo(20)],
      ['Integração Slack não notificando', 'Bot do ServiceDesk parou de enviar mensagens no Slack.', 5, 3, 1, 2, 6, getDaysAgo(21), getDaysAgo(21)],

      // === DAYS 22-30 (OLDER TICKETS) ===
      ['Melhorias na interface mobile', 'Sugestão: Adicionar dark mode no app mobile.', 6, 4, 2, 1, 3, getDaysAgo(22), getDaysAgo(22)],
      ['Documentação API desatualizada', 'Docs da API v2 mostram endpoints inexistentes.', 8, 3, 6, 2, 2, getDaysAgo(23), getDaysAgo(23)],
      ['Logs de auditoria não gravando', 'Sistema de logs não registra ações admin há 1 semana.', 7, 2, 3, 3, 6, getDaysAgo(24), getDaysAgo(24)],
      ['Implementar autenticação 2FA', 'Solicito implementação de Two-Factor Auth para segurança.', 6, null, 2, 2, 1, getDaysAgo(25), getDaysAgo(25)],
      ['Solicitação acesso ao BI', 'Preciso acesso read-only ao Business Intelligence.', 5, 3, 5, 1, 6, getDaysAgo(26), getDaysAgo(26)],
      ['Erro validação CPF em formulário', 'Validador rejeita CPFs válidos. Ex: 123.456.789-00', 6, 4, 3, 2, 6, getDaysAgo(27), getDaysAgo(27)],
      ['Criar usuários em lote - Marketing', '15 novos usuários para departamento de marketing.', 5, 3, 2, 2, 6, getDaysAgo(28), getDaysAgo(28)],
      ['Monitoramento com muitos falsos positivos', 'Sistema dispara 50+ alertas/dia sem motivo.', 5, 3, 1, 2, 5, getDaysAgo(29), getDaysAgo(29)],
      ['Sessão expirando prematuramente', 'Sessões expiram após 5min. Configurado para 30min.', 6, 2, 3, 2, 5, getDaysAgo(30), getDaysAgo(30)],

      // === ADDITIONAL VOLUME TICKETS ===
      ['Layout quebrado no IE11', 'Página de relatórios não renderiza no IE11. 20% dos usuários.', 8, 4, 3, 1, 3, getDaysAgo(15), getDaysAgo(15)],
      ['CSV com encoding incorreto', 'Acentuação aparece como � no arquivo exportado.', 5, 4, 3, 1, 6, getDaysAgo(11), getDaysAgo(11)],
      ['Filtro por múltiplas categorias', 'Impossível filtrar tickets de 2+ categorias ao mesmo tempo.', 6, null, 2, 1, 1, getDaysAgo(24), getDaysAgo(24)],
      ['Push notifications não funciona iOS 17', 'App não envia push em iPhones com iOS 17+.', 8, 3, 3, 2, 2, getDaysAgo(7), getDaysAgo(7)],
      ['Relatório SLA com dados incorretos', 'Dashboard mostra 100% compliance mas há tickets violados.', 5, 2, 3, 3, 2, getDaysAgo(5), getDaysAgo(5)],
      ['Busca não encontra em comentários', 'Busca só procura em títulos. Não busca conteúdo dos comments.', 7, null, 2, 2, 1, getDaysAgo(18), getDaysAgo(18)],
      ['Upgrade de permissões - Auditoria', 'Acesso admin ao módulo financeiro para auditoria trimestral.', 5, 3, 5, 2, 3, getDaysAgo(5), getDaysAgo(5)],
      ['Erro ao anexar arquivos grandes', 'Upload de PDF >5MB falha com timeout.', 6, 4, 3, 2, 2, getDaysAgo(9), getDaysAgo(9)],
      ['API rate limit muito restritivo', 'Limite de 100 req/min insuficiente. Precisamos 500.', 8, 2, 2, 2, 1, getDaysAgo(16), getDaysAgo(16)],
      ['Botão "Fechar Ticket" não responde', 'Botão não funciona em mobile. Só em desktop.', 5, 4, 3, 2, 5, getDaysAgo(13), getDaysAgo(13)],
      ['Relatório de desempenho de agentes', 'Solicito dashboard com métricas individuais de agentes.', 6, null, 2, 1, 1, getDaysAgo(21), getDaysAgo(21)],
    ];

    let ticketsInserted = 0;
    if (shouldAddTickets) {
      enhancedTickets.forEach(([title, description, userId, assignedTo, categoryId, priorityId, statusId, createdAt, updatedAt]) => {
        insertTicket.run(title, description, userId, assignedTo, categoryId, priorityId, statusId, createdAt, updatedAt);
        ticketsInserted++;
      });
      logger.info(`📝 Added ${ticketsInserted} additional tickets`);
    } else {
      logger.info(`✅ Database already has ${ticketCount.count} tickets, skipping ticket creation`);
    }

    // Add comments to recent tickets to show activity (only if we added tickets)
    if (shouldAddTickets && ticketsInserted > 0) {
      const insertComment = db.prepare(`
        INSERT INTO comments (ticket_id, user_id, content, is_internal, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      const enhancedComments = [
        // Recent critical tickets
        [ticketCount.count + 1, 2, 'URGENTE: Gateway Stripe fora do ar. Abrindo ticket de suporte com eles.', 1, getDaysAgo(0)],
        [ticketCount.count + 1, 6, 'Clientes ligando desesperados! Perdendo vendas!', 0, getDaysAgo(0)],
        [ticketCount.count + 2, 2, 'Expandindo disco de 500GB para 1TB. ETA: 20 minutos.', 1, getDaysAgo(0)],
        [ticketCount.count + 4, 2, 'CPU em 95%. Processo "node worker" consumindo recursos.', 1, getDaysAgo(1)],
        [ticketCount.count + 4, 5, 'Sistema travando constantemente!', 0, getDaysAgo(1)],
        [ticketCount.count + 5, 2, 'Memory leak identificado no cache layer. Deploy da correção às 22h.', 1, getDaysAgo(1)],
        [ticketCount.count + 11, 2, 'Resetando sessão do usuário. Favor tentar novamente.', 0, getDaysAgo(4)],
        [ticketCount.count + 11, 5, 'Funcionou! Obrigado!', 0, getDaysAgo(4)],
        [ticketCount.count + 12, 3, 'Erro CORS corrigido. Deploy em produção concluído.', 1, getDaysAgo(4)],
      ];

      enhancedComments.forEach(([ticketId, userId, content, isInternal, createdAt]) => {
        insertComment.run(ticketId, userId, content, isInternal, createdAt);
      });
      logger.info(`💬 Added ${enhancedComments.length} comments`);
    }

    // Populate analytics tables with daily metrics for last 30 days
    const insertDailyMetrics = db.prepare(`
      INSERT OR IGNORE INTO analytics_daily_metrics (
        date, tickets_created, tickets_resolved, tickets_reopened,
        avg_first_response_time, avg_resolution_time
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Generate realistic daily metrics
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // More tickets on weekdays, less on weekends
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const baseTickets = isWeekend ? 2 : 5;

      // Random variation
      const created = baseTickets + Math.floor(Math.random() * 3);
      const resolved = Math.max(1, created - Math.floor(Math.random() * 2));
      const reopened = Math.random() > 0.8 ? 1 : 0;

      // Response and resolution times in minutes
      const avgResponse = 30 + Math.floor(Math.random() * 90); // 30-120 min
      const avgResolution = 180 + Math.floor(Math.random() * 300); // 3-8 hours

      insertDailyMetrics.run(
        dateStr,
        created,
        resolved,
        reopened,
        avgResponse,
        avgResolution
      );
    }

    // Populate agent metrics for last 30 days
    const insertAgentMetrics = db.prepare(`
      INSERT OR IGNORE INTO analytics_agent_metrics (
        agent_id, date, tickets_assigned, tickets_resolved,
        avg_first_response_time, avg_resolution_time
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const agentIds = [2, 3, 4]; // João Silva, Maria Santos, Pedro Costa

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      agentIds.forEach(agentId => {
        if (!isWeekend || Math.random() > 0.7) { // Agents mostly work on weekdays
          const assigned = 1 + Math.floor(Math.random() * 4);
          const resolved = Math.max(0, assigned - Math.floor(Math.random() * 2));
          const avgResponse = 20 + Math.floor(Math.random() * 80);
          const avgResolution = 150 + Math.floor(Math.random() * 250);

          insertAgentMetrics.run(
            agentId,
            dateStr,
            assigned,
            resolved,
            avgResponse,
            avgResolution
          );
        }
      });
    }

    // Populate category metrics
    const insertCategoryMetrics = db.prepare(`
      INSERT OR IGNORE INTO analytics_category_metrics (
        category_id, date, tickets_created, tickets_resolved,
        avg_resolution_time
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const categoryIds = [1, 2, 3, 4, 5, 6]; // All categories

    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      categoryIds.forEach(categoryId => {
        const created = isWeekend ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 4);
        if (created > 0) {
          const resolved = Math.max(0, created - Math.floor(Math.random() * 2));
          const avgResolution = 120 + Math.floor(Math.random() * 360);

          insertCategoryMetrics.run(
            categoryId,
            dateStr,
            created,
            resolved,
            avgResolution
          );
        }
      });
    }

    const stats = {
      tickets: ticketsInserted,
      comments: enhancedComments.length,
      dailyMetrics: 31,
      agentMetrics: agentIds.length * 31,
      categoryMetrics: 'variable',
    };

    logger.info('\n✅ Enhanced demo data seeded successfully!\n');
    logger.info('📊 ENHANCED SEED STATISTICS:');
    logger.info(`   🎫 Additional Tickets: ${stats.tickets}`);
    logger.info(`   💬 Additional Comments: ${stats.comments}`);
    logger.info(`   📈 Daily Metrics: ${stats.dailyMetrics} days`);
    logger.info(`   👤 Agent Metrics: ${stats.agentMetrics} records`);
    logger.info(`   📁 Category Metrics: Last 30 days`);
    logger.info('\n🎉 Dashboard now has realistic data for last 30 days!\n');

    return true;
  } catch (error) {
    logger.error('❌ Error seeding enhanced data', error);
    return false;
  }
}
