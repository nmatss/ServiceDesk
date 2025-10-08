-- ========================================
-- ENTERPRISE EXTENSION SCHEMA
-- ServiceDesk Database Enterprise Features
-- This file extends the main schema with missing enterprise functionality
-- ========================================

-- ========================================
-- WORKFLOW ENGINE AVANÇADO (COMPLEMENTAR)
-- ========================================

-- Tabela de condições de workflow (complementar)
CREATE TABLE IF NOT EXISTS workflow_conditions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER,
    step_id INTEGER,
    name TEXT NOT NULL,
    condition_type TEXT NOT NULL CHECK (condition_type IN ('field_value', 'time_based', 'user_role', 'custom_script', 'sla_status', 'previous_step_result')),
    field_name TEXT, -- campo a ser verificado
    operator TEXT NOT NULL CHECK (operator IN ('equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'not_contains', 'in', 'not_in', 'regex', 'between')),
    expected_value TEXT, -- valor esperado
    value_type TEXT DEFAULT 'string' CHECK (value_type IN ('string', 'number', 'boolean', 'date', 'json')),
    logic_operator TEXT DEFAULT 'AND' CHECK (logic_operator IN ('AND', 'OR', 'NOT')),
    condition_group TEXT, -- para agrupamento de condições
    condition_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata TEXT, -- JSON com configurações extras
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE
);

-- Tabela de variáveis de workflow
CREATE TABLE IF NOT EXISTS workflow_variables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER,
    execution_id INTEGER,
    variable_name TEXT NOT NULL,
    variable_type TEXT DEFAULT 'string' CHECK (variable_type IN ('string', 'number', 'boolean', 'date', 'json', 'array')),
    variable_value TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    scope TEXT DEFAULT 'execution' CHECK (scope IN ('global', 'workflow', 'execution', 'step')),
    created_by_step_id INTEGER,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_step_id) REFERENCES workflow_steps(id) ON DELETE SET NULL
);

-- ========================================
-- SISTEMA DE AUTOMAÇÃO ENTERPRISE
-- ========================================

-- Tabela de regras de automação avançadas
CREATE TABLE IF NOT EXISTS automation_rules_advanced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id INTEGER NOT NULL,
    rule_group TEXT, -- agrupamento lógico de regras
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('pre_condition', 'filter', 'transformation', 'post_condition', 'validation')),
    field_path TEXT NOT NULL, -- suporte a campos aninhados (ex: "ticket.category.name")
    operator TEXT NOT NULL CHECK (operator IN (
        'equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal',
        'contains', 'not_contains', 'starts_with', 'ends_with', 'in', 'not_in', 'regex',
        'is_null', 'is_not_null', 'has_changed', 'changed_from', 'changed_to',
        'date_within', 'date_before', 'date_after', 'time_between'
    )),
    value_source TEXT DEFAULT 'literal' CHECK (value_source IN ('literal', 'field', 'variable', 'function', 'user_input')),
    comparison_value TEXT,
    comparison_field TEXT, -- para comparar com outro campo
    value_function TEXT, -- função para gerar valor dinamicamente
    logic_operator TEXT DEFAULT 'AND' CHECK (logic_operator IN ('AND', 'OR', 'NOT', 'XOR')),
    rule_order INTEGER DEFAULT 0,
    weight DECIMAL(3,2) DEFAULT 1.0, -- peso da regra (para regras probabilísticas)
    is_mandatory BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    error_handling TEXT DEFAULT 'fail' CHECK (error_handling IN ('fail', 'skip', 'continue', 'retry')),
    metadata TEXT, -- JSON com configurações adicionais
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
);

-- Tabela de ações de automação avançadas
CREATE TABLE IF NOT EXISTS automation_actions_advanced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id INTEGER NOT NULL,
    action_group TEXT, -- agrupamento de ações
    name TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN (
        'field_update', 'status_change', 'assignment', 'notification', 'escalation',
        'webhook_call', 'email_send', 'sms_send', 'whatsapp_send', 'teams_notify',
        'create_subtask', 'create_followup', 'merge_tickets', 'split_ticket',
        'add_tag', 'remove_tag', 'add_comment', 'add_attachment', 'log_activity',
        'run_script', 'call_api', 'trigger_workflow', 'schedule_action',
        'update_sla', 'create_approval', 'send_survey', 'update_metrics'
    )),
    execution_order INTEGER DEFAULT 0,
    execution_delay_minutes INTEGER DEFAULT 0,
    execution_condition TEXT, -- condição para executar esta ação
    configuration TEXT NOT NULL, -- JSON com configuração específica
    rollback_configuration TEXT, -- JSON para desfazer a ação se necessário
    timeout_seconds INTEGER DEFAULT 300,
    retry_policy TEXT DEFAULT 'exponential' CHECK (retry_policy IN ('none', 'fixed', 'exponential', 'custom')),
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 5,
    error_handling TEXT DEFAULT 'fail' CHECK (error_handling IN ('fail', 'skip', 'continue', 'escalate')),
    success_condition TEXT, -- condição para considerar sucesso
    failure_threshold INTEGER DEFAULT 1, -- quantas falhas para considerar falhado
    is_async BOOLEAN DEFAULT FALSE,
    is_reversible BOOLEAN DEFAULT FALSE,
    cost_impact TEXT, -- impacto de custo da ação
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
);

-- Tabela de logs de automação detalhados
CREATE TABLE IF NOT EXISTS automation_execution_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id INTEGER NOT NULL,
    execution_id TEXT NOT NULL, -- UUID único para cada execução
    rule_id INTEGER,
    action_id INTEGER,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    execution_phase TEXT NOT NULL CHECK (execution_phase IN ('pre_validation', 'rule_evaluation', 'action_execution', 'post_validation', 'rollback')),
    phase_status TEXT NOT NULL CHECK (phase_status IN ('started', 'completed', 'failed', 'skipped', 'retrying')),
    input_data TEXT, -- JSON com dados de entrada
    output_data TEXT, -- JSON com dados de saída
    error_details TEXT, -- JSON com detalhes de erro
    execution_time_ms INTEGER,
    memory_usage_kb INTEGER,
    retry_count INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES automation_rules_advanced(id) ON DELETE SET NULL,
    FOREIGN KEY (action_id) REFERENCES automation_actions_advanced(id) ON DELETE SET NULL
);

-- ========================================
-- INTEGRAÇÃO COM IA AVANÇADA
-- ========================================

-- Tabela de modelos de IA configurados
CREATE TABLE IF NOT EXISTS ai_models_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('classification', 'sentiment', 'text_generation', 'summarization', 'translation', 'entity_extraction', 'intent_detection')),
    provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'aws', 'local', 'huggingface')),
    model_identifier TEXT NOT NULL, -- ex: 'gpt-4', 'claude-3-sonnet', 'gemini-pro'
    api_endpoint TEXT,
    api_version TEXT,
    configuration TEXT NOT NULL, -- JSON com configurações do modelo
    cost_per_input_token DECIMAL(10,8), -- custo por token de entrada
    cost_per_output_token DECIMAL(10,8), -- custo por token de saída
    rate_limit_per_minute INTEGER DEFAULT 60,
    max_context_length INTEGER DEFAULT 4000,
    supports_streaming BOOLEAN DEFAULT FALSE,
    supports_function_calling BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    quality_score DECIMAL(4,3), -- 0.000 a 1.000
    latency_ms_avg INTEGER,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de prompts de IA
CREATE TABLE IF NOT EXISTS ai_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('classification', 'summarization', 'response_generation', 'sentiment', 'intent', 'extraction')),
    model_type TEXT NOT NULL,
    prompt_template TEXT NOT NULL, -- template com placeholders
    system_prompt TEXT, -- prompt de sistema
    few_shot_examples TEXT, -- JSON com exemplos few-shot
    parameters TEXT, -- JSON com parâmetros (temperature, max_tokens, etc.)
    input_schema TEXT, -- JSON schema dos dados de entrada esperados
    output_schema TEXT, -- JSON schema da saída esperada
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    performance_metrics TEXT, -- JSON com métricas de performance
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de execuções de IA
CREATE TABLE IF NOT EXISTS ai_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_config_id INTEGER NOT NULL,
    prompt_id INTEGER,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    input_text TEXT NOT NULL,
    input_tokens INTEGER,
    output_text TEXT,
    output_tokens INTEGER,
    total_cost_cents INTEGER, -- custo em centavos
    execution_time_ms INTEGER,
    confidence_score DECIMAL(4,3),
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'timeout')),
    error_message TEXT,
    metadata TEXT, -- JSON com metadados adicionais
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_config_id) REFERENCES ai_models_config(id) ON DELETE CASCADE,
    FOREIGN KEY (prompt_id) REFERENCES ai_prompts(id) ON DELETE SET NULL
);

-- Tabela de feedback de IA
CREATE TABLE IF NOT EXISTS ai_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    execution_id INTEGER,
    classification_id INTEGER,
    suggestion_id INTEGER,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('accuracy', 'relevance', 'helpfulness', 'quality', 'bias')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    expected_output TEXT, -- o que deveria ter sido a saída
    correction_data TEXT, -- JSON com dados de correção
    feedback_source TEXT DEFAULT 'user' CHECK (feedback_source IN ('user', 'agent', 'admin', 'system', 'automated')),
    provided_by INTEGER,
    is_training_data BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (execution_id) REFERENCES ai_executions(id) ON DELETE CASCADE,
    FOREIGN KEY (classification_id) REFERENCES ai_classifications(id) ON DELETE CASCADE,
    FOREIGN KEY (suggestion_id) REFERENCES ai_suggestions(id) ON DELETE CASCADE,
    FOREIGN KEY (provided_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- ANALYTICS E BUSINESS INTELLIGENCE
-- ========================================

-- Tabela de métricas customizadas
CREATE TABLE IF NOT EXISTS analytics_custom_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram', 'summary')),
    calculation_method TEXT NOT NULL CHECK (calculation_method IN ('sum', 'count', 'average', 'median', 'min', 'max', 'percentile', 'custom')),
    sql_query TEXT, -- query SQL para calcular a métrica
    data_source TEXT NOT NULL CHECK (data_source IN ('tickets', 'users', 'sla', 'satisfaction', 'knowledge_base', 'custom')),
    dimensions TEXT, -- JSON array de dimensões disponíveis
    filters TEXT, -- JSON com filtros padrão
    refresh_frequency TEXT DEFAULT 'hourly' CHECK (refresh_frequency IN ('realtime', 'minutely', 'hourly', 'daily', 'weekly', 'monthly', 'manual')),
    unit TEXT, -- unidade da métrica (seconds, count, percentage, etc.)
    format_pattern TEXT, -- padrão de formatação para exibição
    thresholds TEXT, -- JSON com limites (warning, critical)
    is_active BOOLEAN DEFAULT TRUE,
    is_public BOOLEAN DEFAULT FALSE,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de valores de métricas customizadas
CREATE TABLE IF NOT EXISTS analytics_metric_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_id INTEGER NOT NULL,
    dimension_values TEXT, -- JSON com valores das dimensões
    value DECIMAL(15,4) NOT NULL,
    count INTEGER DEFAULT 1,
    timestamp DATETIME NOT NULL,
    period_start DATETIME,
    period_end DATETIME,
    metadata TEXT, -- JSON com dados adicionais
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (metric_id) REFERENCES analytics_custom_metrics(id) ON DELETE CASCADE
);

-- Tabela de dashboards avançados
CREATE TABLE IF NOT EXISTS analytics_dashboards_advanced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    dashboard_type TEXT DEFAULT 'operational' CHECK (dashboard_type IN ('operational', 'executive', 'analytical', 'tactical')),
    layout_config TEXT NOT NULL, -- JSON com layout responsivo
    widgets_config TEXT NOT NULL, -- JSON com configuração de widgets
    filters_config TEXT, -- JSON com filtros globais do dashboard
    refresh_interval_seconds INTEGER DEFAULT 300,
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'team', 'department', 'organization', 'public')),
    access_permissions TEXT, -- JSON com permissões específicas
    owner_id INTEGER NOT NULL,
    shared_with TEXT, -- JSON array de user IDs
    is_default BOOLEAN DEFAULT FALSE,
    is_template BOOLEAN DEFAULT FALSE,
    tags TEXT, -- JSON array de tags
    view_count INTEGER DEFAULT 0,
    last_viewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de relatórios agendados avançados
CREATE TABLE IF NOT EXISTS analytics_scheduled_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('tickets', 'sla', 'agents', 'satisfaction', 'trends', 'forecast', 'custom')),
    data_source_config TEXT NOT NULL, -- JSON com configuração de fonte de dados
    filters_config TEXT, -- JSON com filtros aplicados
    schedule_expression TEXT NOT NULL, -- expressão cron para agendamento
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    output_format TEXT DEFAULT 'pdf' CHECK (output_format IN ('pdf', 'excel', 'csv', 'json', 'html')),
    template_config TEXT, -- JSON com configuração do template
    recipients TEXT NOT NULL, -- JSON array de destinatários
    delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'webhook', 'slack', 'teams', 'whatsapp')),
    include_attachments BOOLEAN DEFAULT TRUE,
    compress_output BOOLEAN DEFAULT FALSE,
    retention_days INTEGER DEFAULT 30, -- quantos dias manter os relatórios
    is_active BOOLEAN DEFAULT TRUE,
    last_executed_at DATETIME,
    next_execution_at DATETIME,
    execution_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- INTEGRAÇÕES ENTERPRISE
-- ========================================

-- Tabela de conectores de integração
CREATE TABLE IF NOT EXISTS integration_connectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    connector_type TEXT NOT NULL CHECK (connector_type IN ('database', 'api', 'file', 'message_queue', 'webhook', 'rpc')),
    protocol TEXT NOT NULL CHECK (protocol IN ('http', 'https', 'grpc', 'graphql', 'rest', 'soap', 'ftp', 'sftp', 'jdbc', 'amqp', 'mqtt')),
    connection_string TEXT NOT NULL,
    authentication_type TEXT CHECK (authentication_type IN ('none', 'basic', 'bearer', 'oauth2', 'api_key', 'certificate', 'saml')),
    credentials_config TEXT, -- JSON com configuração de credenciais (criptografado)
    connection_pool_config TEXT, -- JSON com configuração de pool de conexões
    timeout_seconds INTEGER DEFAULT 30,
    retry_policy TEXT DEFAULT 'exponential' CHECK (retry_policy IN ('none', 'fixed', 'exponential', 'custom')),
    max_retries INTEGER DEFAULT 3,
    circuit_breaker_config TEXT, -- JSON com configuração do circuit breaker
    health_check_config TEXT, -- JSON com configuração de health check
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,
    last_health_check DATETIME,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de mapeamentos de dados para integração
CREATE TABLE IF NOT EXISTS integration_data_mappings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    integration_id INTEGER,
    connector_id INTEGER,
    mapping_name TEXT NOT NULL,
    source_entity TEXT NOT NULL, -- entidade origem
    target_entity TEXT NOT NULL, -- entidade destino
    mapping_type TEXT NOT NULL CHECK (mapping_type IN ('one_to_one', 'one_to_many', 'many_to_one', 'many_to_many')),
    field_mappings TEXT NOT NULL, -- JSON com mapeamento de campos
    transformation_rules TEXT, -- JSON com regras de transformação
    validation_rules TEXT, -- JSON com regras de validação
    conflict_resolution TEXT DEFAULT 'source_wins' CHECK (conflict_resolution IN ('source_wins', 'target_wins', 'merge', 'manual', 'skip')),
    sync_direction TEXT NOT NULL CHECK (sync_direction IN ('inbound', 'outbound', 'bidirectional')),
    sync_frequency TEXT DEFAULT 'manual' CHECK (sync_frequency IN ('realtime', 'minutely', 'hourly', 'daily', 'weekly', 'manual')),
    last_sync_at DATETIME,
    sync_status TEXT DEFAULT 'never_synced' CHECK (sync_status IN ('never_synced', 'syncing', 'synced', 'error', 'conflict')),
    error_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
    FOREIGN KEY (connector_id) REFERENCES integration_connectors(id) ON DELETE CASCADE
);

-- ========================================
-- RECURSOS ESPECÍFICOS DO BRASIL AVANÇADOS
-- ========================================

-- Tabela de configurações WhatsApp Business
CREATE TABLE IF NOT EXISTS whatsapp_business_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_account_id TEXT UNIQUE NOT NULL,
    phone_number_id TEXT UNIQUE NOT NULL,
    phone_number TEXT NOT NULL,
    display_name TEXT NOT NULL,
    about TEXT,
    address TEXT,
    description TEXT,
    email TEXT,
    website TEXT,
    vertical TEXT, -- categoria do negócio
    access_token TEXT NOT NULL, -- criptografado
    webhook_verify_token TEXT NOT NULL,
    webhook_url TEXT,
    profile_picture_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'restricted', 'rate_limited')),
    quality_score TEXT, -- GREEN, YELLOW, RED
    messaging_limit TEXT DEFAULT 'tier_1k' CHECK (messaging_limit IN ('tier_250', 'tier_1k', 'tier_10k', 'tier_100k', 'tier_unlimited')),
    last_sync_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de templates de mensagem WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    language TEXT NOT NULL DEFAULT 'pt_BR',
    category TEXT NOT NULL CHECK (category IN ('authentication', 'marketing', 'utility')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
    template_id TEXT UNIQUE, -- ID do template no WhatsApp
    components TEXT NOT NULL, -- JSON com componentes do template
    rejection_reason TEXT,
    quality_score TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de campanhas WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    template_id INTEGER NOT NULL,
    target_audience TEXT NOT NULL, -- JSON com critérios de audiência
    message_variables TEXT, -- JSON com variáveis da mensagem
    schedule_type TEXT DEFAULT 'immediate' CHECK (schedule_type IN ('immediate', 'scheduled', 'triggered')),
    scheduled_for DATETIME,
    trigger_conditions TEXT, -- JSON com condições de disparo
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed')),
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    started_at DATETIME,
    completed_at DATETIME,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES whatsapp_message_templates(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de dados gov.br expandida
CREATE TABLE IF NOT EXISTS govbr_citizen_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    cpf TEXT UNIQUE NOT NULL,
    rg TEXT,
    nome_completo TEXT NOT NULL,
    nome_social TEXT,
    data_nascimento DATE,
    sexo TEXT CHECK (sexo IN ('M', 'F', 'X')),
    estado_civil TEXT,
    profissao TEXT,
    escolaridade TEXT,
    endereco_completo TEXT, -- JSON com endereço completo
    telefones TEXT, -- JSON array de telefones
    emails TEXT, -- JSON array de emails
    renda_declarada DECIMAL(10,2),
    situacao_cpf TEXT, -- regular, irregular, suspenso, etc.
    titulo_eleitor TEXT,
    pis_pasep TEXT,
    carteira_trabalho TEXT,
    nivel_confiabilidade TEXT DEFAULT 'bronze' CHECK (nivel_confiabilidade IN ('bronze', 'prata', 'ouro')),
    dados_biometricos TEXT, -- JSON com dados biométricos se disponível
    ultima_atualizacao DATETIME,
    fonte_dados TEXT, -- de onde vieram os dados
    consentimento_uso BOOLEAN DEFAULT FALSE,
    consentimento_data DATETIME,
    is_validated BOOLEAN DEFAULT FALSE,
    validated_at DATETIME,
    validated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela de integrações com órgãos públicos
CREATE TABLE IF NOT EXISTS govbr_agency_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agency_name TEXT NOT NULL,
    agency_code TEXT UNIQUE NOT NULL, -- código oficial do órgão
    service_type TEXT NOT NULL CHECK (service_type IN ('consultation', 'validation', 'certification', 'notification', 'payment')),
    api_endpoint TEXT NOT NULL,
    api_version TEXT,
    authentication_config TEXT NOT NULL, -- JSON com configuração de auth
    certificate_path TEXT, -- caminho para certificado digital
    rate_limit_per_hour INTEGER DEFAULT 1000,
    cost_per_request DECIMAL(6,4), -- custo por requisição
    sla_response_time_ms INTEGER, -- SLA de tempo de resposta
    availability_schedule TEXT, -- JSON com horários de disponibilidade
    is_active BOOLEAN DEFAULT TRUE,
    is_production BOOLEAN DEFAULT FALSE, -- se está em produção ou homologação
    last_health_check DATETIME,
    health_status TEXT DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'degraded', 'unavailable', 'unknown')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de registros LGPD expandida
CREATE TABLE IF NOT EXISTS lgpd_data_processing_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    processing_activity TEXT NOT NULL,
    data_controller_info TEXT NOT NULL, -- JSON com info do controlador
    data_processor_info TEXT, -- JSON com info do operador
    legal_basis TEXT NOT NULL CHECK (legal_basis IN ('consent', 'contract', 'legal_obligation', 'vital_interests', 'public_task', 'legitimate_interests')),
    personal_data_categories TEXT NOT NULL, -- JSON array de categorias
    data_subjects_categories TEXT NOT NULL, -- JSON array de categorias de titulares
    processing_purposes TEXT NOT NULL, -- JSON array de finalidades
    retention_period TEXT NOT NULL,
    security_measures TEXT NOT NULL, -- JSON com medidas de segurança
    transfers_to_third_parties TEXT, -- JSON com transferências
    international_transfers TEXT, -- JSON com transferências internacionais
    data_sources TEXT, -- JSON array de fontes de dados
    automated_decision_making BOOLEAN DEFAULT FALSE,
    profiling_activities TEXT, -- JSON com atividades de profiling
    privacy_impact_assessment TEXT, -- JSON com resultado da AIPD
    dpo_contact TEXT, -- contato do DPO
    last_review_date DATE,
    next_review_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'under_review', 'terminated')),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- ========================================
-- AUDITORIA E COMPLIANCE AVANÇADO
-- ========================================

-- Tabela de trilhas de auditoria detalhadas
CREATE TABLE IF NOT EXISTS audit_trails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_log_id INTEGER NOT NULL,
    trail_type TEXT NOT NULL CHECK (trail_type IN ('data_access', 'data_modification', 'system_access', 'configuration_change', 'security_event')),
    source_system TEXT DEFAULT 'servicedesk',
    correlation_id TEXT, -- para correlacionar eventos relacionados
    business_context TEXT, -- contexto de negócio da ação
    technical_context TEXT, -- contexto técnico
    data_classification TEXT CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
    sensitivity_level INTEGER CHECK (sensitivity_level >= 1 AND sensitivity_level <= 5),
    compliance_frameworks TEXT, -- JSON array de frameworks (LGPD, SOX, ISO27001, etc.)
    retention_requirements TEXT, -- JSON com requisitos de retenção
    geographic_location TEXT, -- localização geográfica do evento
    device_info TEXT, -- JSON com informações do dispositivo
    network_info TEXT, -- JSON com informações de rede
    risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    anomaly_indicators TEXT, -- JSON com indicadores de anomalia
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE CASCADE
);

-- Tabela de eventos de compliance
CREATE TABLE IF NOT EXISTS compliance_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL CHECK (event_type IN ('data_breach', 'privacy_violation', 'access_violation', 'retention_violation', 'consent_violation')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    framework TEXT NOT NULL CHECK (framework IN ('LGPD', 'GDPR', 'SOX', 'ISO27001', 'PCI_DSS', 'HIPAA')),
    description TEXT NOT NULL,
    affected_data_subjects INTEGER DEFAULT 0,
    affected_data_categories TEXT, -- JSON array
    potential_impact TEXT,
    detection_method TEXT CHECK (detection_method IN ('automated', 'manual', 'reported', 'audit')),
    detected_by INTEGER,
    incident_id TEXT UNIQUE, -- ID único do incidente
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'contained', 'resolved', 'closed')),
    assigned_to INTEGER,
    resolution_steps TEXT, -- JSON array de steps de resolução
    notification_required BOOLEAN DEFAULT FALSE,
    notification_deadline DATETIME,
    notifications_sent TEXT, -- JSON com notificações enviadas
    regulatory_response TEXT, -- resposta de órgãos reguladores
    lessons_learned TEXT,
    cost_impact DECIMAL(10,2),
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (detected_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- ========================================
-- ÍNDICES OTIMIZADOS PARA TODAS AS NOVAS TABELAS
-- ========================================

-- Workflow Engine Avançado
CREATE INDEX IF NOT EXISTS idx_workflow_conditions_workflow ON workflow_conditions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_conditions_step ON workflow_conditions(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_conditions_type ON workflow_conditions(condition_type);
CREATE INDEX IF NOT EXISTS idx_workflow_conditions_active ON workflow_conditions(is_active);

CREATE INDEX IF NOT EXISTS idx_workflow_variables_workflow ON workflow_variables(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_variables_execution ON workflow_variables(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_variables_name ON workflow_variables(variable_name);
CREATE INDEX IF NOT EXISTS idx_workflow_variables_scope ON workflow_variables(scope);

-- Automação Avançada
CREATE INDEX IF NOT EXISTS idx_automation_rules_advanced_automation ON automation_rules_advanced(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_advanced_group ON automation_rules_advanced(rule_group);
CREATE INDEX IF NOT EXISTS idx_automation_rules_advanced_type ON automation_rules_advanced(rule_type);
CREATE INDEX IF NOT EXISTS idx_automation_rules_advanced_active ON automation_rules_advanced(is_active);

CREATE INDEX IF NOT EXISTS idx_automation_actions_advanced_automation ON automation_actions_advanced(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_actions_advanced_group ON automation_actions_advanced(action_group);
CREATE INDEX IF NOT EXISTS idx_automation_actions_advanced_type ON automation_actions_advanced(action_type);
CREATE INDEX IF NOT EXISTS idx_automation_actions_advanced_order ON automation_actions_advanced(execution_order);

CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_automation ON automation_execution_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_execution_id ON automation_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_entity ON automation_execution_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_phase ON automation_execution_logs(execution_phase);

-- IA Avançada
CREATE INDEX IF NOT EXISTS idx_ai_models_config_type ON ai_models_config(model_type);
CREATE INDEX IF NOT EXISTS idx_ai_models_config_provider ON ai_models_config(provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_config_active ON ai_models_config(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_models_config_default ON ai_models_config(is_default);

CREATE INDEX IF NOT EXISTS idx_ai_prompts_category ON ai_prompts(category);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_model_type ON ai_prompts(model_type);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_prompts(is_active);

CREATE INDEX IF NOT EXISTS idx_ai_executions_model ON ai_executions(model_config_id);
CREATE INDEX IF NOT EXISTS idx_ai_executions_entity ON ai_executions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_executions_status ON ai_executions(status);
CREATE INDEX IF NOT EXISTS idx_ai_executions_created ON ai_executions(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_execution ON ai_feedback(execution_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_type ON ai_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_rating ON ai_feedback(rating);

-- Analytics Avançado
CREATE INDEX IF NOT EXISTS idx_analytics_custom_metrics_type ON analytics_custom_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_analytics_custom_metrics_active ON analytics_custom_metrics(is_active);
CREATE INDEX IF NOT EXISTS idx_analytics_custom_metrics_public ON analytics_custom_metrics(is_public);

CREATE INDEX IF NOT EXISTS idx_analytics_metric_values_metric ON analytics_metric_values(metric_id);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_values_timestamp ON analytics_metric_values(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_metric_values_period ON analytics_metric_values(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_advanced_owner ON analytics_dashboards_advanced(owner_id);
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_advanced_type ON analytics_dashboards_advanced(dashboard_type);
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_advanced_visibility ON analytics_dashboards_advanced(visibility);

CREATE INDEX IF NOT EXISTS idx_analytics_scheduled_reports_type ON analytics_scheduled_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_analytics_scheduled_reports_active ON analytics_scheduled_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_analytics_scheduled_reports_next_execution ON analytics_scheduled_reports(next_execution_at);

-- Integrações Avançadas
CREATE INDEX IF NOT EXISTS idx_integration_connectors_type ON integration_connectors(connector_type);
CREATE INDEX IF NOT EXISTS idx_integration_connectors_active ON integration_connectors(is_active);
CREATE INDEX IF NOT EXISTS idx_integration_connectors_health ON integration_connectors(health_status);

CREATE INDEX IF NOT EXISTS idx_integration_data_mappings_integration ON integration_data_mappings(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_data_mappings_connector ON integration_data_mappings(connector_id);
CREATE INDEX IF NOT EXISTS idx_integration_data_mappings_active ON integration_data_mappings(is_active);

-- Brasil Específico Avançado
CREATE INDEX IF NOT EXISTS idx_whatsapp_business_config_phone ON whatsapp_business_config(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_business_config_status ON whatsapp_business_config(status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_message_templates_name ON whatsapp_message_templates(name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_templates_status ON whatsapp_message_templates(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_templates_category ON whatsapp_message_templates(category);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_status ON whatsapp_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_scheduled ON whatsapp_campaigns(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_created_by ON whatsapp_campaigns(created_by);

CREATE INDEX IF NOT EXISTS idx_govbr_citizen_data_cpf ON govbr_citizen_data(cpf);
CREATE INDEX IF NOT EXISTS idx_govbr_citizen_data_user ON govbr_citizen_data(user_id);
CREATE INDEX IF NOT EXISTS idx_govbr_citizen_data_validated ON govbr_citizen_data(is_validated);

CREATE INDEX IF NOT EXISTS idx_govbr_agency_integrations_code ON govbr_agency_integrations(agency_code);
CREATE INDEX IF NOT EXISTS idx_govbr_agency_integrations_type ON govbr_agency_integrations(service_type);
CREATE INDEX IF NOT EXISTS idx_govbr_agency_integrations_active ON govbr_agency_integrations(is_active);

CREATE INDEX IF NOT EXISTS idx_lgpd_data_processing_records_basis ON lgpd_data_processing_records(legal_basis);
CREATE INDEX IF NOT EXISTS idx_lgpd_data_processing_records_status ON lgpd_data_processing_records(status);
CREATE INDEX IF NOT EXISTS idx_lgpd_data_processing_records_review ON lgpd_data_processing_records(next_review_date);

-- Auditoria Avançada
CREATE INDEX IF NOT EXISTS idx_audit_trails_audit_log ON audit_trails(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_audit_trails_type ON audit_trails(trail_type);
CREATE INDEX IF NOT EXISTS idx_audit_trails_classification ON audit_trails(data_classification);
CREATE INDEX IF NOT EXISTS idx_audit_trails_risk ON audit_trails(risk_score);

CREATE INDEX IF NOT EXISTS idx_compliance_events_type ON compliance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_severity ON compliance_events(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_events_framework ON compliance_events(framework);
CREATE INDEX IF NOT EXISTS idx_compliance_events_status ON compliance_events(status);
CREATE INDEX IF NOT EXISTS idx_compliance_events_assigned ON compliance_events(assigned_to);

-- ========================================
-- TRIGGERS ENTERPRISE AVANÇADOS
-- ========================================

-- Trigger para auditoria automática de mudanças críticas
CREATE TRIGGER IF NOT EXISTS audit_critical_enterprise_changes
    AFTER UPDATE ON ai_models_config
    WHEN OLD.is_active != NEW.is_active OR OLD.configuration != NEW.configuration
    BEGIN
        INSERT INTO audit_logs (entity_type, entity_id, action, old_values, new_values, user_id)
        VALUES (
            'ai_model_config',
            NEW.id,
            'critical_update',
            json_object('is_active', OLD.is_active, 'configuration', OLD.configuration),
            json_object('is_active', NEW.is_active, 'configuration', NEW.configuration),
            NEW.created_by
        );

        INSERT INTO security_events (
            event_type, severity, description, metadata
        )
        VALUES (
            'configuration_change',
            'high',
            'Configuração crítica de modelo de IA alterada',
            json_object(
                'model_id', NEW.id,
                'model_name', NEW.name,
                'changes', json_object('is_active', NEW.is_active != OLD.is_active, 'config_changed', NEW.configuration != OLD.configuration)
            )
        );
    END;

-- Trigger para compliance automático em eventos LGPD
CREATE TRIGGER IF NOT EXISTS lgpd_compliance_monitoring
    AFTER INSERT ON lgpd_consents
    WHEN NEW.is_given = 0 OR NEW.withdrawn_at IS NOT NULL
    BEGIN
        INSERT INTO compliance_events (
            event_type, severity, framework, description, affected_data_subjects,
            detection_method, detected_by, notification_required
        )
        VALUES (
            'consent_violation',
            CASE WHEN NEW.consent_type = 'data_processing' THEN 'high' ELSE 'medium' END,
            'LGPD',
            'Consentimento retirado ou negado para: ' || NEW.consent_type,
            1,
            'automated',
            NULL,
            CASE WHEN NEW.consent_type = 'data_processing' THEN 1 ELSE 0 END
        );
    END;

-- Trigger para métricas em tempo real
CREATE TRIGGER IF NOT EXISTS update_realtime_metrics_enterprise
    AFTER INSERT ON ai_executions
    WHEN NEW.status = 'completed'
    BEGIN
        -- Atualizar métricas de IA
        INSERT OR REPLACE INTO analytics_realtime_metrics (metric_name, metric_value, timestamp)
        VALUES (
            'ai_executions_per_hour',
            (SELECT COUNT(*) FROM ai_executions WHERE created_at > datetime('now', '-1 hour')),
            datetime('now')
        );

        INSERT OR REPLACE INTO analytics_realtime_metrics (metric_name, metric_value, timestamp)
        VALUES (
            'ai_avg_confidence_score',
            (SELECT AVG(confidence_score) FROM ai_executions WHERE created_at > datetime('now', '-1 hour') AND confidence_score IS NOT NULL),
            datetime('now')
        );
    END;

-- Trigger para limpeza automática de dados expirados
CREATE TRIGGER IF NOT EXISTS cleanup_expired_enterprise_data
    AFTER INSERT ON analytics_realtime_metrics
    WHEN datetime('now', 'localtime') LIKE '%00:05:%' -- executa a cada 5 minutos na hora cheia
    BEGIN
        -- Limpar métricas em tempo real expiradas
        DELETE FROM analytics_realtime_metrics WHERE expires_at < datetime('now');

        -- Limpar execuções de IA antigas (mais de 6 meses)
        DELETE FROM ai_executions WHERE created_at < datetime('now', '-6 months') AND status IN ('completed', 'failed');

        -- Limpar logs de automação antigos (mais de 1 ano)
        DELETE FROM automation_execution_logs WHERE started_at < datetime('now', '-1 year');

        -- Limpar variáveis de workflow expiradas
        DELETE FROM workflow_variables WHERE expires_at < datetime('now');

        -- Limpar dados de auditoria com retenção expirada
        DELETE FROM audit_trails
        WHERE audit_log_id IN (
            SELECT id FROM audit_logs
            WHERE created_at < datetime('now', '-7 years') -- retenção padrão de 7 anos
        );
    END;

-- Trigger para automação de workflows em mudanças de compliance
CREATE TRIGGER IF NOT EXISTS trigger_compliance_workflows
    AFTER INSERT ON compliance_events
    WHEN NEW.severity IN ('high', 'critical')
    BEGIN
        INSERT INTO workflow_executions (
            workflow_id, trigger_entity_type, trigger_entity_id, trigger_data, trigger_user_id
        )
        SELECT
            w.id,
            'compliance_event',
            NEW.id,
            json_object(
                'event_type', NEW.event_type,
                'severity', NEW.severity,
                'framework', NEW.framework,
                'affected_subjects', NEW.affected_data_subjects
            ),
            NEW.detected_by
        FROM workflows w
        WHERE w.is_active = 1
          AND w.trigger_type = 'compliance_violation'
          AND w.category = 'compliance';
    END;

-- ========================================
-- VIEWS PARA RELATÓRIOS E ANALYTICS
-- ========================================

-- View para métricas consolidadas de IA
CREATE VIEW IF NOT EXISTS v_ai_performance_metrics AS
SELECT
    DATE(ae.created_at) as date,
    amc.model_type,
    amc.provider,
    COUNT(*) as total_executions,
    COUNT(CASE WHEN ae.status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN ae.status = 'failed' THEN 1 END) as failed_executions,
    AVG(ae.confidence_score) as avg_confidence,
    AVG(ae.execution_time_ms) as avg_execution_time_ms,
    SUM(ae.total_cost_cents) as total_cost_cents,
    SUM(ae.input_tokens) as total_input_tokens,
    SUM(ae.output_tokens) as total_output_tokens
FROM ai_executions ae
JOIN ai_models_config amc ON ae.model_config_id = amc.id
GROUP BY DATE(ae.created_at), amc.model_type, amc.provider;

-- View para compliance dashboard
CREATE VIEW IF NOT EXISTS v_compliance_dashboard AS
SELECT
    framework,
    event_type,
    severity,
    COUNT(*) as total_events,
    COUNT(CASE WHEN status = 'open' THEN 1 END) as open_events,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_events,
    AVG(CASE WHEN resolved_at IS NOT NULL
        THEN (julianday(resolved_at) - julianday(created_at)) * 24
        END) as avg_resolution_time_hours,
    SUM(cost_impact) as total_cost_impact
FROM compliance_events
WHERE created_at >= date('now', '-30 days')
GROUP BY framework, event_type, severity;

-- View para performance de automações
CREATE VIEW IF NOT EXISTS v_automation_performance AS
SELECT
    a.name as automation_name,
    a.trigger_type,
    COUNT(ael.id) as total_executions,
    COUNT(CASE WHEN ael.phase_status = 'completed' THEN 1 END) as successful_executions,
    COUNT(CASE WHEN ael.phase_status = 'failed' THEN 1 END) as failed_executions,
    AVG(ael.execution_time_ms) as avg_execution_time_ms,
    DATE(ael.started_at) as execution_date
FROM automations a
LEFT JOIN automation_execution_logs ael ON a.id = ael.automation_id
WHERE ael.started_at >= date('now', '-30 days')
GROUP BY a.id, DATE(ael.started_at);

-- ========================================
-- PROCEDURES E FUNÇÕES (VIA TRIGGERS)
-- ========================================

-- Trigger para calcular score de risco de compliance
CREATE TRIGGER IF NOT EXISTS calculate_compliance_risk_score
    AFTER INSERT ON compliance_events
    BEGIN
        UPDATE compliance_events
        SET cost_impact = (
            CASE
                WHEN NEW.severity = 'critical' AND NEW.affected_data_subjects > 1000 THEN 50000.00
                WHEN NEW.severity = 'high' AND NEW.affected_data_subjects > 100 THEN 10000.00
                WHEN NEW.severity = 'medium' THEN 1000.00
                ELSE 100.00
            END
        )
        WHERE id = NEW.id;
    END;

-- Trigger para auto-atribuição de eventos críticos
CREATE TRIGGER IF NOT EXISTS auto_assign_critical_compliance_events
    AFTER INSERT ON compliance_events
    WHEN NEW.severity = 'critical'
    BEGIN
        UPDATE compliance_events
        SET
            assigned_to = (
                SELECT u.id FROM users u
                JOIN user_roles ur ON u.id = ur.user_id
                JOIN roles r ON ur.role_id = r.id
                WHERE r.name = 'compliance_officer'
                AND u.is_active = 1
                LIMIT 1
            ),
            notification_required = 1,
            notification_deadline = datetime('now', '+24 hours')
        WHERE id = NEW.id;
    END;