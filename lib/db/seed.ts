import db from './connection';
import { hashPassword } from '../auth/sqlite-auth';
import { logger } from '../monitoring/logger';

/**
 * Insere dados iniciais no banco de dados
 */
export async function seedDatabase() {
  try {
    // Verifica se já existem dados
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    if (userCount.count > 0) {
      logger.info('📊 Database already has data, skipping seed');
      return true;
    }

    logger.info('🌱 Seeding database with initial data...');

    // Hash da senha padrão 123456
    const defaultPasswordHash = await hashPassword('123456');

    // Inserir usuários
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role) 
      VALUES (?, ?, ?, ?)
    `);

    const users = [
      ['Admin User', 'admin@servicedesk.com', defaultPasswordHash, 'admin'],
      ['João Silva', 'joao.silva@servicedesk.com', defaultPasswordHash, 'agent'],
      ['Maria Santos', 'maria.santos@servicedesk.com', defaultPasswordHash, 'agent'],
      ['Pedro Costa', 'pedro.costa@servicedesk.com', defaultPasswordHash, 'agent'],
      ['Ana Oliveira', 'ana.oliveira@servicedesk.com', defaultPasswordHash, 'user'],
      ['Carlos Ferreira', 'carlos.ferreira@servicedesk.com', defaultPasswordHash, 'user'],
      ['Lucia Rodrigues', 'lucia.rodrigues@servicedesk.com', defaultPasswordHash, 'user'],
      // Usuário de teste específico
      ['Usuário Teste', 'teste@servicedesk.com', defaultPasswordHash, 'user'],
    ];

    users.forEach(([name, email, passwordHash, role]) => {
      insertUser.run(name, email, passwordHash, role);
    });

    // Inserir categorias
    const insertCategory = db.prepare(`
      INSERT INTO categories (name, description, color) 
      VALUES (?, ?, ?)
    `);

    const categories = [
      ['Suporte Técnico', 'Problemas relacionados a hardware, software e sistemas', '#3B82F6'],
      ['Solicitação', 'Novas funcionalidades, melhorias e solicitações', '#10B981'],
      ['Bug Report', 'Relatórios de bugs e problemas encontrados', '#EF4444'],
      ['Dúvida', 'Perguntas e esclarecimentos gerais', '#F59E0B'],
      ['Acesso', 'Solicitações de acesso a sistemas e permissões', '#8B5CF6'],
      ['Outros', 'Demais assuntos não categorizados', '#6B7280'],
    ];

    categories.forEach(([name, description, color]) => {
      insertCategory.run(name, description, color);
    });

    // Inserir prioridades
    const insertPriority = db.prepare(`
      INSERT INTO priorities (name, level, color) 
      VALUES (?, ?, ?)
    `);

    const priorities = [
      ['Baixa', 1, '#10B981'],
      ['Média', 2, '#F59E0B'],
      ['Alta', 3, '#EF4444'],
      ['Crítica', 4, '#DC2626'],
    ];

    priorities.forEach(([name, level, color]) => {
      insertPriority.run(name, level, color);
    });

    // Inserir status
    const insertStatus = db.prepare(`
      INSERT INTO statuses (name, description, color, is_final) 
      VALUES (?, ?, ?, ?)
    `);

    const statuses = [
      ['Novo', 'Ticket recém-criado, aguardando triagem', '#3B82F6', false],
      ['Em Andamento', 'Ticket sendo trabalhado por um agente', '#F59E0B', false],
      ['Aguardando Cliente', 'Aguardando resposta ou informações do cliente', '#8B5CF6', false],
      ['Aguardando Terceiros', 'Aguardando resposta de terceiros ou fornecedores', '#6B7280', false],
      ['Resolvido', 'Problema foi resolvido, aguardando confirmação', '#10B981', false],
      ['Fechado', 'Ticket finalizado e fechado', '#374151', true],
      ['Cancelado', 'Ticket cancelado por algum motivo', '#EF4444', true],
    ];

    statuses.forEach(([name, description, color, isFinal]) => {
      insertStatus.run(name, description, color, isFinal ? 1 : 0);
    });

    // Inserir alguns tickets de exemplo
    const insertTicket = db.prepare(`
      INSERT INTO tickets (title, description, user_id, assigned_to, category_id, priority_id, status_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const tickets = [
      [
        'Problema com login no sistema',
        'Não consigo fazer login no sistema principal. Recebo erro "credenciais inválidas" mesmo usando as credenciais corretas.',
        5, // Ana Oliveira
        2, // João Silva
        1, // Suporte Técnico
        2, // Média
        2, // Em Andamento
      ],
      [
        'Solicitação de novo usuário',
        'Preciso criar um novo usuário para o departamento de vendas. Nome: Roberto Lima, email: roberto.lima@empresa.com',
        6, // Carlos Ferreira
        3, // Maria Santos
        5, // Acesso
        1, // Baixa
        1, // Novo
      ],
      [
        'Erro na impressão de relatórios',
        'Ao tentar imprimir relatórios mensais, o sistema apresenta erro e não consegue gerar o PDF.',
        7, // Lucia Rodrigues
        4, // Pedro Costa
        3, // Bug Report
        3, // Alta
        1, // Novo
      ],
      [
        'Dúvida sobre funcionalidade X',
        'Gostaria de saber como usar a funcionalidade de exportação de dados. Existe algum tutorial disponível?',
        5, // Ana Oliveira
        null, // Não atribuído
        4, // Dúvida
        1, // Baixa
        1, // Novo
      ],
    ];

    tickets.forEach(([title, description, userId, assignedTo, categoryId, priorityId, statusId]) => {
      insertTicket.run(title, description, userId, assignedTo, categoryId, priorityId, statusId);
    });

    // Inserir alguns comentários de exemplo
    const insertComment = db.prepare(`
      INSERT INTO comments (ticket_id, user_id, content, is_internal) 
      VALUES (?, ?, ?, ?)
    `);

    const comments = [
      [1, 2, 'Olá Ana! Vou verificar o problema com suas credenciais. Pode confirmar se está usando o email correto?', false],
      [1, 5, 'Sim, estou usando ana.oliveira@empresa.com. Já tentei resetar a senha também.', false],
      [1, 2, 'Verifiquei aqui e suas credenciais estão corretas. Pode tentar limpar o cache do navegador?', false],
      [2, 3, 'Vou criar o usuário Roberto Lima conforme solicitado. Aguarde alguns minutos.', false],
      [3, 4, 'Identifiquei o problema. É um bug conhecido na versão atual. Vou aplicar uma correção temporária.', true],
    ];

    comments.forEach(([ticketId, userId, content, isInternal]) => {
      insertComment.run(ticketId, userId, content, isInternal ? 1 : 0);
    });

    // Inserir políticas de SLA
    const insertSLAPolicy = db.prepare(`
      INSERT INTO sla_policies (name, description, priority_id, category_id, response_time_minutes, resolution_time_minutes, escalation_time_minutes, business_hours_only, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const slaPolicies = [
      ['SLA Crítica', 'Para tickets de prioridade crítica', 4, null, 15, 240, 60, false, true], // 15min response, 4h resolution, 1h escalation
      ['SLA Alta', 'Para tickets de prioridade alta', 3, null, 60, 480, 120, true, true], // 1h response, 8h resolution, 2h escalation
      ['SLA Média', 'Para tickets de prioridade média', 2, null, 240, 1440, 480, true, true], // 4h response, 24h resolution, 8h escalation
      ['SLA Baixa', 'Para tickets de prioridade baixa', 1, null, 480, 2880, null, true, true], // 8h response, 48h resolution, no escalation
      ['SLA Suporte Técnico', 'SLA específico para suporte técnico', 2, 1, 120, 720, 240, true, true], // 2h response, 12h resolution, 4h escalation
    ];

    slaPolicies.forEach(([name, description, priorityId, categoryId, responseTime, resolutionTime, escalationTime, businessHours, isActive]) => {
      insertSLAPolicy.run(name, description, priorityId, categoryId, responseTime, resolutionTime, escalationTime, businessHours ? 1 : 0, isActive ? 1 : 0);
    });

    // Inserir templates de tickets
    const insertTemplate = db.prepare(`
      INSERT INTO ticket_templates (name, description, category_id, priority_id, title_template, description_template, tags, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const templates = [
      [
        'Problema de Login',
        'Template para problemas de acesso ao sistema',
        1, // Suporte Técnico
        2, // Média
        'Problema de acesso - {{user_name}}',
        'Usuário: {{user_name}}\nEmail: {{user_email}}\nSistema: {{system_name}}\n\nDescrição do problema:\n- Não consegue fazer login\n- Erro apresentado: {{error_message}}\n- Último acesso bem-sucedido: {{last_login}}\n\nPróximos passos:\n1. Verificar credenciais\n2. Resetar senha se necessário\n3. Verificar bloqueios de conta',
        JSON.stringify(['login', 'acesso', 'credenciais']),
        true,
        1 // Admin User
      ],
      [
        'Solicitação de Acesso',
        'Template para solicitações de novo acesso',
        5, // Acesso
        1, // Baixa
        'Solicitação de acesso - {{new_user_name}}',
        'Solicitação de acesso para:\nNome: {{new_user_name}}\nEmail: {{new_user_email}}\nDepartamento: {{department}}\nCargo: {{position}}\nSolicitado por: {{requester_name}}\n\nPermissões necessárias:\n- {{permission_1}}\n- {{permission_2}}\n- {{permission_3}}\n\nJustificativa: {{justification}}',
        JSON.stringify(['acesso', 'permissões', 'novo-usuário']),
        true,
        1
      ],
      [
        'Bug Report',
        'Template para relatório de bugs',
        3, // Bug Report
        3, // Alta
        'Bug: {{bug_summary}}',
        'Resumo do bug: {{bug_summary}}\n\nPassos para reproduzir:\n1. {{step_1}}\n2. {{step_2}}\n3. {{step_3}}\n\nResultado esperado: {{expected_result}}\nResultado atual: {{actual_result}}\n\nAmbiente:\n- SO: {{operating_system}}\n- Navegador: {{browser}}\n- Versão: {{version}}\n\nAnexos: {{attachments}}\n\nImpacto: {{impact_level}}',
        JSON.stringify(['bug', 'erro', 'desenvolvimento']),
        true,
        1
      ]
    ];

    templates.forEach(([name, description, categoryId, priorityId, titleTemplate, descriptionTemplate, tags, isActive, createdBy]) => {
      insertTemplate.run(name, description, categoryId, priorityId, titleTemplate, descriptionTemplate, tags, isActive ? 1 : 0, createdBy);
    });

    // Inserir configurações do sistema
    const insertSetting = db.prepare(`
      INSERT INTO system_settings (key, value, description, type, is_public, updated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

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
      ['max_file_upload_size', '10485760', 'Tamanho máximo de upload (bytes)', 'number', false, 1], // 10MB
      ['allowed_file_types', JSON.stringify(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'txt']), 'Tipos de arquivo permitidos', 'json', false, 1],
      ['ticket_auto_close_days', '30', 'Dias para fechamento automático de tickets resolvidos', 'number', false, 1],
      ['knowledge_base_enabled', 'true', 'Habilitar base de conhecimento', 'boolean', true, 1],
      ['satisfaction_survey_enabled', 'true', 'Habilitar pesquisa de satisfação', 'boolean', true, 1],
      ['escalation_enabled', 'true', 'Habilitar escalações automáticas', 'boolean', false, 1]
    ];

    settings.forEach(([key, value, description, type, isPublic, updatedBy]) => {
      insertSetting.run(key, value, description, type, isPublic ? 1 : 0, updatedBy);
    });

    // Inserir algumas automações de exemplo
    const insertAutomation = db.prepare(`
      INSERT INTO automations (name, description, trigger_type, conditions, actions, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const automations = [
      [
        'Auto-atribuir tickets críticos',
        'Atribui automaticamente tickets críticos para o agente sênior',
        'ticket_created',
        JSON.stringify({
          priority_level: 4,
          category_id: null
        }),
        JSON.stringify({
          assign_to: 2, // João Silva (agent)
          add_comment: 'Ticket crítico atribuído automaticamente',
          send_notification: true
        }),
        true,
        1
      ],
      [
        'Escalar tickets em atraso',
        'Escala tickets que não tiveram resposta dentro do SLA',
        'sla_warning',
        JSON.stringify({
          minutes_until_breach: 30,
          response_overdue: true
        }),
        JSON.stringify({
          escalate_to: 1, // Admin
          priority_increase: true,
          send_email: true,
          add_comment: 'Ticket escalado devido a atraso no SLA'
        }),
        true,
        1
      ],
      [
        'Notificar gerente sobre tickets críticos',
        'Envia notificação para o gerente quando ticket crítico é criado',
        'ticket_created',
        JSON.stringify({
          priority_level: 4
        }),
        JSON.stringify({
          send_email_to: ['admin@servicedesk.com'],
          send_notification_to: [1], // Admin
          message: 'Novo ticket crítico criado: {{ticket_title}}'
        }),
        true,
        1
      ]
    ];

    automations.forEach(([name, description, triggerType, conditions, actions, isActive, createdBy]) => {
      insertAutomation.run(name, description, triggerType, conditions, actions, isActive ? 1 : 0, createdBy);
    });

    // Inserir artigos de knowledge base
    const insertKnowledge = db.prepare(`
      INSERT INTO knowledge_articles (title, content, summary, category_id, tags, is_published, view_count, helpful_count, not_helpful_count, author_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const articles = [
      [
        'Como resetar sua senha',
        'Para resetar sua senha:\n\n1. Acesse a página de login\n2. Clique em "Esqueci minha senha"\n3. Digite seu email\n4. Verifique sua caixa de email\n5. Siga as instruções do email\n\nSe não receber o email em 5 minutos, verifique a pasta de spam.\n\nSe ainda tiver problemas, entre em contato com o suporte.',
        'Instruções passo a passo para resetar senha',
        1, // Suporte Técnico
        JSON.stringify(['senha', 'login', 'reset', 'acesso']),
        true,
        45,
        38,
        2,
        2 // João Silva
      ],
      [
        'Configuração de VPN',
        'Para configurar a VPN da empresa:\n\n## Windows\n1. Baixe o cliente VPN no portal de TI\n2. Execute o instalador como administrador\n3. Use suas credenciais corporativas\n\n## Mac\n1. Baixe o perfil VPN\n2. Abra Preferências do Sistema > Rede\n3. Adicione uma nova conexão VPN\n4. Importe o perfil\n\n## Mobile\n1. Baixe o app da VPN na loja\n2. Configure com os dados fornecidos pelo TI\n\nPara problemas, contate o suporte técnico.',
        'Como configurar VPN corporativa em diferentes dispositivos',
        1,
        JSON.stringify(['vpn', 'rede', 'acesso-remoto', 'configuração']),
        true,
        123,
        89,
        5,
        2
      ],
      [
        'Política de Senhas',
        'Nossa política de senhas visa garantir a segurança:\n\n## Requisitos\n- Mínimo 8 caracteres\n- Pelo menos 1 letra maiúscula\n- Pelo menos 1 letra minúscula\n- Pelo menos 1 número\n- Pelo menos 1 caractere especial\n\n## Boas Práticas\n- Use senhas únicas para cada sistema\n- Não compartilhe senhas\n- Use gerenciador de senhas\n- Altere senhas comprometidas imediatamente\n\n## Troca Obrigatória\n- A cada 90 dias\n- Quando solicitado pelo TI\n- Em caso de suspeita de comprometimento',
        'Política e requisitos para senhas corporativas',
        5, // Acesso
        JSON.stringify(['segurança', 'senha', 'política', 'compliance']),
        true,
        67,
        52,
        3,
        1 // Admin
      ]
    ];

    articles.forEach(([title, content, summary, categoryId, tags, isPublished, viewCount, helpfulCount, notHelpfulCount, authorId]) => {
      insertKnowledge.run(title, content, summary, categoryId, tags, isPublished ? 1 : 0, viewCount, helpfulCount, notHelpfulCount, authorId);
    });

    logger.info('✅ Database seeded successfully with advanced features');
    return true;
  } catch (error) {
    logger.error('❌ Error seeding database', error);
    return false;
  }
}

/**
 * Limpa todos os dados do banco (útil para desenvolvimento)
 */
export function clearDatabase() {
  try {
    logger.info('🧹 Clearing database...');
    
    // Desabilitar foreign keys temporariamente
    db.pragma('foreign_keys = OFF');
    
    // Limpar todas as tabelas na ordem correta (devido às foreign keys)
    const tables = [
      'satisfaction_surveys',
      'knowledge_articles',
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

    tables.forEach(table => {
      db.prepare(`DELETE FROM ${table}`).run();
      db.prepare(`DELETE FROM sqlite_sequence WHERE name='${table}'`).run();
    });
    
    // Reabilitar foreign keys
    db.pragma('foreign_keys = ON');
    
    logger.info('✅ Database cleared successfully');
    return true;
  } catch (error) {
    logger.error('❌ Error clearing database', error);
    return false;
  }
}
