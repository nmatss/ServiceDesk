import { executeQuery, executeQueryOne, executeRun } from '@/lib/db/adapter';
import { getDatabaseType } from '@/lib/db/config';
import { hashPassword } from '../auth/sqlite-auth';
import logger from '../monitoring/structured-logger';
import { kbArticles } from './kb-seed-data';

/**
 * Insere dados iniciais no banco de dados
 */
export async function seedDatabase() {
  try {
    // Verifica se já existem dados
    const userCount = await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM users');
    if (userCount && userCount.count > 0) {
      logger.info('Database already has data, skipping seed');
      return true;
    }

    logger.info('Seeding database with initial data...');

    const isPg = getDatabaseType() === 'postgresql';

    // Criar organização padrão primeiro (se não existir)
    const existingOrg = await executeQueryOne<{ id: number }>('SELECT id FROM organizations WHERE slug = ?', ['demo']);

    if (!existingOrg) {
      await executeRun(`
        INSERT INTO organizations (name, slug, domain, subscription_plan, subscription_status, max_users, max_tickets_per_month, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'ServiceDesk Demo',
        'demo',
        'localhost',
        'professional',
        'active',
        100,
        10000,
        1
      ]);

      logger.info('Default organization created (ID: 1, slug: demo)');
    } else {
      logger.info('Default organization already exists (ID: 1, slug: demo)');
    }

    // Hash da senha padrão 123456
    const defaultPasswordHash = await hashPassword('123456');

    // Inserir usuários
    const users = [
      ['Admin User', 'admin@servicedesk.com', defaultPasswordHash, 'admin'],
      ['João Silva', 'joao.silva@servicedesk.com', defaultPasswordHash, 'agent'],
      ['Maria Santos', 'maria.santos@servicedesk.com', defaultPasswordHash, 'agent'],
      ['Pedro Costa', 'pedro.costa@servicedesk.com', defaultPasswordHash, 'agent'],
      ['Ana Oliveira', 'ana.oliveira@servicedesk.com', defaultPasswordHash, 'user'],
      ['Carlos Ferreira', 'carlos.ferreira@servicedesk.com', defaultPasswordHash, 'user'],
      ['Lucia Rodrigues', 'lucia.rodrigues@servicedesk.com', defaultPasswordHash, 'user'],
      ['Roberto Lima', 'roberto.lima@servicedesk.com', defaultPasswordHash, 'user'],
      ['Fernanda Souza', 'fernanda.souza@servicedesk.com', defaultPasswordHash, 'user'],
      ['Ricardo Almeida', 'ricardo.almeida@servicedesk.com', defaultPasswordHash, 'user'],
      ['Usuário Teste', 'teste@servicedesk.com', defaultPasswordHash, 'user'],
    ];

    for (const [name, email, passwordHash, role] of users) {
      await executeRun(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `, [name, email, passwordHash, role]);
    }

    // Inserir categorias
    const categories = [
      ['Suporte Técnico', 'Problemas relacionados a hardware, software e sistemas', '#3B82F6'],
      ['Solicitação', 'Novas funcionalidades, melhorias e solicitações', '#10B981'],
      ['Bug Report', 'Relatórios de bugs e problemas encontrados', '#EF4444'],
      ['Dúvida', 'Perguntas e esclarecimentos gerais', '#F59E0B'],
      ['Acesso', 'Solicitações de acesso a sistemas e permissões', '#8B5CF6'],
      ['Outros', 'Demais assuntos não categorizados', '#6B7280'],
    ];

    for (const [name, description, color] of categories) {
      await executeRun(`
        INSERT INTO categories (name, description, color)
        VALUES (?, ?, ?)
      `, [name, description, color]);
    }

    // Inserir prioridades
    const priorities = [
      ['Baixa', 1, '#10B981'],
      ['Média', 2, '#F59E0B'],
      ['Alta', 3, '#EF4444'],
      ['Crítica', 4, '#DC2626'],
    ];

    for (const [name, level, color] of priorities) {
      await executeRun(`
        INSERT INTO priorities (name, level, color)
        VALUES (?, ?, ?)
      `, [name, level, color]);
    }

    // Inserir status
    const statuses = [
      ['Novo', 'Ticket recém-criado, aguardando triagem', '#3B82F6', false],
      ['Em Andamento', 'Ticket sendo trabalhado por um agente', '#F59E0B', false],
      ['Aguardando Cliente', 'Aguardando resposta ou informações do cliente', '#8B5CF6', false],
      ['Aguardando Terceiros', 'Aguardando resposta de terceiros ou fornecedores', '#6B7280', false],
      ['Resolvido', 'Problema foi resolvido, aguardando confirmação', '#10B981', false],
      ['Fechado', 'Ticket finalizado e fechado', '#374151', true],
      ['Cancelado', 'Ticket cancelado por algum motivo', '#EF4444', true],
    ];

    for (const [name, description, color, isFinal] of statuses) {
      await executeRun(`
        INSERT INTO statuses (name, description, color, is_final)
        VALUES (?, ?, ?, ?)
      `, [name, description, color, isFinal ? 1 : 0]);
    }

    // Inserir alguns tickets de exemplo
    const tickets = [
      ['Sistema de pagamento fora do ar', 'O sistema de pagamento está completamente indisponível desde as 14h. Clientes não conseguem finalizar compras. URGENTE!', 6, 2, 1, 4, 2],
      ['Servidor de produção com alta latência', 'Servidor principal apresentando latência de 5-10 segundos. Impactando todos os usuários em produção.', 5, 2, 1, 4, 2],
      ['Erro na impressão de relatórios financeiros', 'Ao tentar imprimir relatórios mensais, o sistema apresenta erro 500 e não gera o PDF.', 7, 4, 3, 3, 1],
      ['Vazamento de memória no módulo de vendas', 'Aplicação consumindo 95% da RAM após 2 horas de uso. Requer restart frequente.', 6, 2, 3, 3, 2],
      ['Integração com ERP falhando', 'A sincronização com SAP está falhando desde ontem. Pedidos não estão sendo exportados.', 5, 3, 1, 3, 2],
      ['Falha no backup automático', 'Sistema de backup não está executando há 3 dias. Último backup bem-sucedido foi 72h atrás.', 7, 4, 1, 3, 1],
      ['Problema com login no sistema', 'Não consigo fazer login no sistema principal. Recebo erro "credenciais inválidas" mesmo usando as credenciais corretas.', 5, 2, 1, 2, 2],
      ['Dashboard não carrega gráficos', 'Os gráficos do dashboard administrativo não estão sendo exibidos. Console mostra erro de CORS.', 6, 3, 3, 2, 3],
      ['Lentidão no módulo de relatórios', 'Relatórios customizados demorando mais de 2 minutos para carregar. Antes era instantâneo.', 7, null, 1, 2, 1],
      ['Solicitação de upgrade de permissões', 'Necessito acesso de administrador ao módulo financeiro para realizar auditoria trimestral.', 5, 3, 5, 2, 3],
      ['Erro ao exportar dados para Excel', 'Função de exportar para Excel retorna arquivo corrompido. Testado em Chrome e Firefox.', 6, 4, 3, 2, 2],
      ['Notificações por email não chegando', 'Não estou recebendo emails de notificação de tickets. Verificado spam e outras pastas.', 7, null, 1, 2, 1],
      ['Campo de data não aceita formato DD/MM/YYYY', 'Formulário só aceita MM/DD/YYYY mas usuários brasileiros precisam de DD/MM/YYYY.', 5, 4, 3, 2, 2],
      ['Solicitação de novo usuário', 'Preciso criar um novo usuário para o departamento de vendas. Nome: Roberto Lima, email: roberto.lima@empresa.com', 6, 3, 5, 1, 1],
      ['Dúvida sobre funcionalidade de exportação', 'Gostaria de saber como usar a funcionalidade de exportação de dados. Existe algum tutorial disponível?', 5, null, 4, 1, 1],
      ['Alterar meu email cadastrado', 'Mudei de departamento e preciso atualizar meu email no sistema de joao.antigo@empresa.com para joao.novo@empresa.com', 8, null, 2, 1, 5],
      ['Solicitação de treinamento - Sistema CRM', 'Nossa equipe precisa de treinamento no novo módulo CRM. Somos 5 pessoas.', 6, 3, 2, 1, 3],
      ['Acesso à VPN para home office', 'Preciso configurar VPN para trabalhar remotamente. Sou do departamento financeiro.', 7, 2, 5, 1, 5],
      ['Como criar relatórios customizados?', 'Gostaria de aprender a criar relatórios personalizados. Existe documentação?', 5, null, 4, 1, 1],
      ['Adicionar assinatura de email corporativa', 'Preciso configurar assinatura de email padrão da empresa no Outlook.', 6, null, 2, 1, 1],
      ['Instalação de software Office 365', 'Preciso instalar o pacote Office 365 na minha estação de trabalho.', 8, 2, 2, 1, 5],
      ['Reset de senha - Acesso bloqueado', 'Minha conta foi bloqueada após 3 tentativas incorretas de senha. Preciso desbloquear.', 5, 2, 5, 2, 5],
      ['Configuração de impressora de rede', 'Nova impressora HP instalada no 3º andar. Preciso configurar para usar.', 7, 4, 1, 1, 6],
      ['Solicitação de licença AutoCAD', 'Necessito licença do AutoCAD 2024 para projeto de engenharia.', 6, 3, 2, 2, 6],
      ['Migração de dados para novo servidor', 'Transferir banco de dados de clientes para novo servidor PostgreSQL.', 5, 2, 1, 3, 6],
      ['Erro 404 na página de produtos', 'Página /produtos/categoria/eletronicos retorna 404. Era funcional semana passada.', 6, 4, 3, 3, 1],
      ['Solicitação de aumento de cota de storage', 'Minha cota de 50GB está 98% cheia. Preciso de mais 50GB para backups de projeto.', 7, 2, 2, 1, 3],
      ['Integração Slack não notificando', 'Bot do ServiceDesk no Slack parou de enviar notificações desde segunda-feira.', 5, 3, 1, 2, 2],
      ['Melhorias na interface mobile', 'Sugestão: Adicionar modo escuro na versão mobile do app. Facilita uso noturno.', 6, null, 2, 1, 1],
      ['Documentação da API desatualizada', 'Documentação da API v2 mostra endpoints que não existem mais. Precisa atualização.', 8, null, 6, 2, 1],
    ];

    for (const [title, description, userId, assignedTo, categoryId, priorityId, statusId] of tickets) {
      await executeRun(`
        INSERT INTO tickets (title, description, user_id, assigned_to, category_id, priority_id, status_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [title, description, userId, assignedTo, categoryId, priorityId, statusId]);
    }

    // Inserir alguns comentários de exemplo
    const comments = [
      [1, 2, 'URGENTE: Investigando o problema. Servidor de pagamento reportando erro 503. Escalando para infraestrutura.', true],
      [1, 6, 'Confirmando: tentei processar um pagamento e recebi timeout. Clientes estão reclamando nas redes sociais!', false],
      [1, 2, 'Identificado: Gateway de pagamento da Stripe com instabilidade. Equipe técnica trabalhando na solução.', false],
      [1, 1, 'Time de infraestrutura acionado. ETA de resolução: 30 minutos.', true],
      [2, 2, 'Monitoramento mostra CPU em 95% e memória em 87%. Analisando processos...', true],
      [2, 5, 'Impossível trabalhar. Sistema demorando 10+ segundos para qualquer operação.', false],
      [2, 2, 'Encontrado processo órfão consumindo recursos. Reiniciando serviço afetado.', true],
      [7, 2, 'Olá! Vou verificar o problema com suas credenciais. Pode confirmar se está usando o email correto?', false],
      [7, 5, 'Sim, estou usando ana.oliveira@empresa.com. Já tentei resetar a senha também.', false],
      [7, 2, 'Verifiquei aqui e suas credenciais estão corretas. Pode tentar limpar o cache do navegador?', false],
      [7, 5, 'Limpei o cache mas ainda não funcionou. Testei no modo anônimo também.', false],
      [7, 2, 'Vou resetar sua sessão no servidor. Por favor, tente novamente em 2 minutos.', false],
      [8, 3, 'Verificado. Console mostra erro CORS ao tentar carregar dados da API analytics. Abrindo issue para dev.', true],
      [8, 6, 'Isso começou depois da atualização de ontem? Funcionava perfeitamente antes.', false],
      [8, 3, 'Sim, parece relacionado ao deploy das 18h. Vou reverter as mudanças de CORS.', true],
      [14, 3, 'Vou criar o usuário Roberto Lima conforme solicitado. Aguarde alguns minutos.', false],
      [14, 3, 'Usuário criado com sucesso! Credenciais enviadas para roberto.lima@empresa.com', false],
      [14, 6, 'Perfeito! Obrigado pela agilidade.', false],
      [3, 4, 'Identifiquei o problema. É um bug na biblioteca de geração de PDF. Vou aplicar uma correção.', true],
      [3, 7, 'Isso é urgente, preciso enviar relatórios para diretoria até amanhã!', false],
      [3, 4, 'Entendo a urgência. Correção aplicada. Por favor, teste novamente e confirme.', false],
      [4, 2, 'Reproduzido em ambiente de teste. Memory leak no módulo de cache. Trabalhando no fix.', true],
      [4, 6, 'Temos que reiniciar o sistema a cada 2 horas. Produtividade muito impactada.', false],
      [4, 2, 'Hotfix disponível. Deploy agendado para hoje às 20h fora do horário comercial.', true],
      [5, 3, 'Verificando logs de integração. Encontrados 47 erros de timeout nas últimas 24h.', true],
      [5, 5, 'Nosso time comercial está parado. Pedidos acumulando sem sincronizar!', false],
      [5, 3, 'Contatando equipe do SAP. Parece ser problema no endpoint deles.', true],
      [5, 1, 'Equipe SAP confirmou instabilidade. Previsão de normalização: 4 horas.', false],
      [15, 4, 'Olá! Temos documentação completa em nossa base de conhecimento. Vou te enviar o link.', false],
      [15, 5, 'Obrigado! Vou dar uma olhada na documentação.', false],
      [18, 2, 'Conta desbloqueada e senha resetada. Nova senha temporária enviada para seu email.', false],
      [18, 5, 'Recebi! Já consegui acessar. Obrigado!', false],
      [19, 4, 'Impressora configurada com sucesso. Driver instalado e testes de impressão OK.', false],
      [19, 7, 'Testei aqui, funcionando perfeitamente. Ticket pode ser fechado.', false],
      [24, 4, 'Rota removida acidentalmente no último deploy. Restaurando configuração.', true],
      [24, 6, 'Essa página tem muitos acessos orgânicos. SEO sendo impactado!', false],
      [24, 4, 'Rota restaurada. Favor validar se está acessível agora.', false],
      [26, 3, 'Webhook do Slack expirado. Renovando token de autenticação.', true],
      [26, 5, 'Faz falta essas notificações. Time todo reclama.', false],
      [26, 3, 'Token renovado e integração testada. Notificações voltaram ao normal.', false],
      [6, 4, 'Backup manual executado. Investigando por que o agendamento falhou.', true],
      [9, 3, 'Query do relatório otimizada. Tempo de resposta reduzido de 2min para 8seg.', true],
      [11, 4, 'Script de correção aplicado. Arquivos Excel agora exportam corretamente.', false],
      [13, 4, 'Campo de data atualizado para aceitar formatos pt-BR. Deploy em produção amanhã.', true],
      [16, 3, 'Solicitação de treinamento encaminhada para RH. Cronograma será definido em breve.', false],
      [17, 2, 'Acesso VPN configurado. Credenciais enviadas via email seguro.', false],
      [20, 3, 'Licença AutoCAD 2024 ativada. Código de ativação enviado por email.', false],
      [25, 2, 'Cota de storage aumentada para 100GB conforme solicitado.', false],
    ];

    for (const [ticketId, userId, content, isInternal] of comments) {
      await executeRun(`
        INSERT INTO comments (ticket_id, user_id, content, is_internal)
        VALUES (?, ?, ?, ?)
      `, [ticketId, userId, content, isInternal ? 1 : 0]);
    }

    // Inserir políticas de SLA
    const slaPolicies = [
      ['SLA Crítica', 'Para tickets de prioridade crítica', 4, null, 15, 240, 60, false, true],
      ['SLA Alta', 'Para tickets de prioridade alta', 3, null, 60, 480, 120, true, true],
      ['SLA Média', 'Para tickets de prioridade média', 2, null, 240, 1440, 480, true, true],
      ['SLA Baixa', 'Para tickets de prioridade baixa', 1, null, 480, 2880, null, true, true],
      ['SLA Suporte Técnico', 'SLA específico para suporte técnico', 2, 1, 120, 720, 240, true, true],
    ];

    for (const [name, description, priorityId, categoryId, responseTime, resolutionTime, escalationTime, businessHours, isActive] of slaPolicies) {
      await executeRun(`
        INSERT INTO sla_policies (name, description, priority_id, category_id, response_time_minutes, resolution_time_minutes, escalation_time_minutes, business_hours_only, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, description, priorityId, categoryId, responseTime, resolutionTime, escalationTime, businessHours ? 1 : 0, isActive ? 1 : 0]);
    }

    // Inserir templates de tickets
    const templates = [
      [
        'Problema de Login',
        'Template para problemas de acesso ao sistema',
        1, 2,
        'Problema de acesso - {{user_name}}',
        'Usuário: {{user_name}}\nEmail: {{user_email}}\nSistema: {{system_name}}\n\nDescrição do problema:\n- Não consegue fazer login\n- Erro apresentado: {{error_message}}\n- Último acesso bem-sucedido: {{last_login}}\n\nPróximos passos:\n1. Verificar credenciais\n2. Resetar senha se necessário\n3. Verificar bloqueios de conta',
        JSON.stringify(['login', 'acesso', 'credenciais']),
        true, 1
      ],
      [
        'Solicitação de Acesso',
        'Template para solicitações de novo acesso',
        5, 1,
        'Solicitação de acesso - {{new_user_name}}',
        'Solicitação de acesso para:\nNome: {{new_user_name}}\nEmail: {{new_user_email}}\nDepartamento: {{department}}\nCargo: {{position}}\nSolicitado por: {{requester_name}}\n\nPermissões necessárias:\n- {{permission_1}}\n- {{permission_2}}\n- {{permission_3}}\n\nJustificativa: {{justification}}',
        JSON.stringify(['acesso', 'permissões', 'novo-usuário']),
        true, 1
      ],
      [
        'Bug Report',
        'Template para relatório de bugs',
        3, 3,
        'Bug: {{bug_summary}}',
        'Resumo do bug: {{bug_summary}}\n\nPassos para reproduzir:\n1. {{step_1}}\n2. {{step_2}}\n3. {{step_3}}\n\nResultado esperado: {{expected_result}}\nResultado atual: {{actual_result}}\n\nAmbiente:\n- SO: {{operating_system}}\n- Navegador: {{browser}}\n- Versão: {{version}}\n\nAnexos: {{attachments}}\n\nImpacto: {{impact_level}}',
        JSON.stringify(['bug', 'erro', 'desenvolvimento']),
        true, 1
      ]
    ];

    for (const [name, description, categoryId, priorityId, titleTemplate, descriptionTemplate, tags, isActive, createdBy] of templates) {
      await executeRun(`
        INSERT INTO ticket_templates (name, description, category_id, priority_id, title_template, description_template, tags, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, description, categoryId, priorityId, titleTemplate, descriptionTemplate, tags, isActive ? 1 : 0, createdBy]);
    }

    // Inserir configurações do sistema
    const settings = [
      ['company_name', 'ServiceDesk Corp', 'Nome da empresa', 'string', true, 1],
      ['support_email', 'support@servicedesk.com', 'Email de suporte principal', 'string', true, 1],
      ['business_hours_start', '09:00', 'Horário de início do expediente', 'string', true, 1],
      ['business_hours_end', '18:00', 'Horário de fim do expediente', 'string', true, 1],
      ['business_days', JSON.stringify(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']), 'Dias úteis', 'json', true, 1],
      ['timezone', 'America/Sao_Paulo', 'Fuso horário padrão', 'string', true, 1],
      ['auto_assign_tickets', 'true', 'Atribuir tickets automaticamente', 'boolean', false, 1],
      ['email_notifications_enabled', 'true', 'Enviar notificações por email', 'boolean', false, 1],
      ['sla_warnings_enabled', 'true', 'Enviar avisos de SLA', 'boolean', false, 1],
      ['max_file_upload_size', '10485760', 'Tamanho máximo de upload (bytes)', 'number', false, 1],
      ['allowed_file_types', JSON.stringify(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'txt']), 'Tipos de arquivo permitidos', 'json', false, 1],
      ['ticket_auto_close_days', '30', 'Dias para fechamento automático de tickets resolvidos', 'number', false, 1],
      ['knowledge_base_enabled', 'true', 'Habilitar base de conhecimento', 'boolean', true, 1],
      ['satisfaction_survey_enabled', 'true', 'Habilitar pesquisa de satisfação', 'boolean', true, 1],
      ['escalation_enabled', 'true', 'Habilitar escalações automáticas', 'boolean', false, 1]
    ];

    for (const [key, value, description, type, isPublic, updatedBy] of settings) {
      await executeRun(`
        INSERT INTO system_settings (key, value, description, type, is_public, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [key, value, description, type, isPublic ? 1 : 0, updatedBy]);
    }

    // Inserir algumas automações de exemplo
    const automations = [
      [
        'Auto-atribuir tickets críticos',
        'Atribui automaticamente tickets críticos para o agente sênior',
        'ticket_created',
        JSON.stringify({ priority_level: 4, category_id: null }),
        JSON.stringify({ assign_to: 2, add_comment: 'Ticket crítico atribuído automaticamente', send_notification: true }),
        true, 1
      ],
      [
        'Escalar tickets em atraso',
        'Escala tickets que não tiveram resposta dentro do SLA',
        'sla_warning',
        JSON.stringify({ minutes_until_breach: 30, response_overdue: true }),
        JSON.stringify({ escalate_to: 1, priority_increase: true, send_email: true, add_comment: 'Ticket escalado devido a atraso no SLA' }),
        true, 1
      ],
      [
        'Notificar gerente sobre tickets críticos',
        'Envia notificação para o gerente quando ticket crítico é criado',
        'ticket_created',
        JSON.stringify({ priority_level: 4 }),
        JSON.stringify({ send_email_to: ['admin@servicedesk.com'], send_notification_to: [1], message: 'Novo ticket crítico criado: {{ticket_title}}' }),
        true, 1
      ]
    ];

    for (const [name, description, triggerType, conditions, actions, isActive, createdBy] of automations) {
      await executeRun(`
        INSERT INTO automations (name, description, trigger_type, conditions, actions, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [name, description, triggerType, conditions, actions, isActive ? 1 : 0, createdBy]);
    }

    // Inserir categorias da base de conhecimento
    const kbCategories = [
      ['Primeiros Passos', 'primeiros-passos', 'Artigos para novos usuários do sistema', '🚀', '#10B981', 1, true],
      ['Tutoriais', 'tutoriais', 'Guias passo a passo para usar o sistema', '📚', '#3B82F6', 2, true],
      ['Problemas Comuns', 'problemas-comuns', 'Soluções para problemas frequentes', '🔧', '#F59E0B', 3, true],
      ['FAQ', 'faq', 'Perguntas e respostas frequentes', '❓', '#8B5CF6', 4, true],
      ['Boas Práticas', 'boas-praticas', 'Recomendações e melhores práticas', '⭐', '#EC4899', 5, true],
    ];

    for (const [name, slug, description, icon, color, sortOrder, isActive] of kbCategories) {
      await executeRun(`
        INSERT INTO kb_categories (name, slug, description, icon, color, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [name, slug, description, icon, color, sortOrder, isActive ? 1 : 0]);
    }

    // Inserir artigos da base de conhecimento
    const publishedAtExpr = isPg ? 'NOW()' : "datetime('now')";

    for (const [title, slug, summary, content, categoryId, authorId, status, visibility, featured, viewCount, helpfulVotes, notHelpfulVotes, searchKeywords] of kbArticles) {
      await executeRun(`
        INSERT INTO kb_articles (
          title, slug, summary, content, category_id, author_id,
          status, visibility, featured, view_count, helpful_votes, not_helpful_votes,
          search_keywords, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${publishedAtExpr})
      `, [
        title, slug, summary, content, categoryId, authorId,
        status, visibility, featured ? 1 : 0, viewCount, helpfulVotes, notHelpfulVotes,
        searchKeywords
      ]);
    }

    // Contar registros inseridos
    const stats = {
      users: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM users'),
      categories: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM categories'),
      priorities: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM priorities'),
      statuses: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM statuses'),
      tickets: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM tickets'),
      comments: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM comments'),
      sla_policies: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM sla_policies'),
      ticket_templates: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM ticket_templates'),
      kb_articles: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM kb_articles'),
      kb_categories: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM kb_categories'),
      automations: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM automations'),
      system_settings: await executeQueryOne<{ count: number }>('SELECT COUNT(*) as count FROM system_settings'),
    };

    logger.info('Database seeded successfully with COMPLETE demo data!');
    logger.info('SEED STATISTICS:');
    logger.info(`   Users: ${stats.users?.count}`);
    logger.info(`   Categories: ${stats.categories?.count}`);
    logger.info(`   Priorities: ${stats.priorities?.count}`);
    logger.info(`   Statuses: ${stats.statuses?.count}`);
    logger.info(`   Tickets: ${stats.tickets?.count}`);
    logger.info(`   Comments: ${stats.comments?.count}`);
    logger.info(`   SLA Policies: ${stats.sla_policies?.count}`);
    logger.info(`   Templates: ${stats.ticket_templates?.count}`);
    logger.info(`   KB Articles: ${stats.kb_articles?.count}`);
    logger.info(`   KB Categories: ${stats.kb_categories?.count}`);
    logger.info(`   Automations: ${stats.automations?.count}`);
    logger.info(`   System Settings: ${stats.system_settings?.count}`);

    return true;
  } catch (error) {
    logger.error('Error seeding database', error);
    return false;
  }
}

/**
 * Limpa todos os dados do banco (útil para desenvolvimento)
 */
export async function clearDatabase() {
  try {
    logger.info('Clearing database...');

    const isPg = getDatabaseType() === 'postgresql';

    if (!isPg) {
      // SQLite: Desabilitar foreign keys temporariamente via PRAGMA
      await executeRun('PRAGMA foreign_keys = OFF');
    }

    // Limpar todas as tabelas na ordem correta (devido às foreign keys)
    const tables = [
      'satisfaction_surveys',
      'kb_articles',
      'kb_categories',
      'kb_tags',
      'kb_article_tags',
      'kb_article_feedback',
      'automations',
      'audit_logs',
      'system_settings',
      'ticket_templates',
      'notifications',
      'escalations',
      'sla_tracking',
      'sla_policies',
      'attachments',
      'comments',
      'tickets',
      'statuses',
      'priorities',
      'categories',
      'users'
    ];

    if (isPg) {
      // PostgreSQL: Use TRUNCATE CASCADE
      for (const table of tables) {
        await executeRun(`TRUNCATE TABLE ${table} CASCADE`);
      }
    } else {
      // SQLite
      for (const table of tables) {
        await executeRun(`DELETE FROM ${table}`);
        await executeRun(`DELETE FROM sqlite_sequence WHERE name='${table}'`);
      }
      await executeRun('PRAGMA foreign_keys = ON');
    }

    logger.info('Database cleared successfully');
    return true;
  } catch (error) {
    logger.error('Error clearing database', error);
    return false;
  }
}
