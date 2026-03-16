/**
 * ESM Onboarding / Offboarding / Purchasing Workflow Definitions
 *
 * Pre-built multi-step workflows for common cross-department ESM processes.
 * Each definition is serializable JSON compatible with the workflow_definitions table.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkflowStepDef {
  id: string;
  name: string;
  description: string;
  department: string;
  assignee_team?: string;
  type: 'task' | 'approval' | 'notification' | 'conditional';
  sla_hours: number;
  /** Step ids that must complete before this step can start */
  depends_on: string[];
  /** Notifications to send when step starts */
  notifications?: { channel: 'email' | 'system'; to: string; template: string }[];
  /** For conditional steps */
  condition?: { field: string; operator: 'eq' | 'gt' | 'lt'; value: string | number };
}

export interface WorkflowTransitionDef {
  from: string;
  to: string;
  label: string;
  condition?: { field: string; operator: string; value: string | number };
}

export interface ESMWorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: number;
  trigger_template?: string;
  steps: WorkflowStepDef[];
  transitions: WorkflowTransitionDef[];
}

// ---------------------------------------------------------------------------
// 1. Onboarding de Colaborador (15 steps)
// ---------------------------------------------------------------------------

export const onboardingWorkflow: ESMWorkflowDefinition = {
  id: 'wf-onboarding',
  name: 'Onboarding de Colaborador',
  description: 'Fluxo completo de integracao de novo colaborador envolvendo RH, TI, Facilities e Financeiro.',
  version: 1,
  trigger_template: 'hr-admissao',
  steps: [
    {
      id: 'onb-01',
      name: 'Criar perfil do colaborador',
      description: 'RH cria o cadastro completo no sistema de gestao de pessoas.',
      department: 'RH',
      assignee_team: 'RH - Admissao',
      type: 'task',
      sla_hours: 4,
      depends_on: [],
      notifications: [{ channel: 'email', to: 'rh-admissao', template: 'novo_colaborador' }],
    },
    {
      id: 'onb-02',
      name: 'Aprovar contratacao',
      description: 'Gestor responsavel aprova a contratacao do candidato.',
      department: 'Gestao',
      type: 'approval',
      sla_hours: 24,
      depends_on: ['onb-01'],
      notifications: [{ channel: 'email', to: 'gestor', template: 'aprovacao_contratacao' }],
    },
    {
      id: 'onb-03',
      name: 'Provisionar e-mail corporativo',
      description: 'TI cria conta de e-mail e configura Microsoft 365 / Google Workspace.',
      department: 'TI',
      assignee_team: 'Operacoes - Acessos',
      type: 'task',
      sla_hours: 8,
      depends_on: ['onb-02'],
    },
    {
      id: 'onb-04',
      name: 'Provisionar notebook',
      description: 'TI prepara o notebook com imagem padrao e softwares necessarios.',
      department: 'TI',
      assignee_team: 'Operacoes - Hardware',
      type: 'task',
      sla_hours: 16,
      depends_on: ['onb-02'],
    },
    {
      id: 'onb-05',
      name: 'Criar acessos a sistemas',
      description: 'TI cria login em ERP, CRM, VPN e demais sistemas necessarios.',
      department: 'TI',
      assignee_team: 'Operacoes - Acessos',
      type: 'task',
      sla_hours: 8,
      depends_on: ['onb-03'],
    },
    {
      id: 'onb-06',
      name: 'Preparar posto de trabalho',
      description: 'Facilities prepara mesa, cadeira, ramal telefonico e cracha.',
      department: 'Facilities',
      assignee_team: 'Facilities - Espacos',
      type: 'task',
      sla_hours: 16,
      depends_on: ['onb-02'],
    },
    {
      id: 'onb-07',
      name: 'Emitir cracha de acesso',
      description: 'Facilities emite cracha com foto e configura acesso fisico.',
      department: 'Facilities',
      assignee_team: 'Facilities - Seguranca',
      type: 'task',
      sla_hours: 8,
      depends_on: ['onb-06'],
    },
    {
      id: 'onb-08',
      name: 'Cadastrar beneficios',
      description: 'RH registra o colaborador nos planos de saude, odontologico, VR, VT e demais beneficios.',
      department: 'RH',
      assignee_team: 'RH - Beneficios',
      type: 'task',
      sla_hours: 24,
      depends_on: ['onb-02'],
    },
    {
      id: 'onb-09',
      name: 'Configurar folha de pagamento',
      description: 'Financeiro inclui o colaborador na folha de pagamento e configura dados bancarios.',
      department: 'Financeiro',
      assignee_team: 'Financeiro - Folha',
      type: 'task',
      sla_hours: 24,
      depends_on: ['onb-01'],
    },
    {
      id: 'onb-10',
      name: 'Agendar integracao institucional',
      description: 'RH agenda apresentacao da empresa, cultura, politicas e codigo de etica.',
      department: 'RH',
      assignee_team: 'RH - Treinamento',
      type: 'task',
      sla_hours: 16,
      depends_on: ['onb-02'],
    },
    {
      id: 'onb-11',
      name: 'Agendar treinamentos obrigatorios',
      description: 'Gestor agenda treinamentos tecnicos e de compliance obrigatorios.',
      department: 'RH',
      assignee_team: 'RH - Treinamento',
      type: 'task',
      sla_hours: 24,
      depends_on: ['onb-10'],
    },
    {
      id: 'onb-12',
      name: 'Enviar kit de boas-vindas',
      description: 'RH envia kit de boas-vindas com materiais da empresa.',
      department: 'RH',
      assignee_team: 'RH - Admissao',
      type: 'task',
      sla_hours: 16,
      depends_on: ['onb-02'],
    },
    {
      id: 'onb-13',
      name: 'Configurar ramais e telefonia',
      description: 'TI configura ramal, softphone e integracao com Teams/Slack.',
      department: 'TI',
      assignee_team: 'Operacoes - Infra',
      type: 'task',
      sla_hours: 8,
      depends_on: ['onb-06'],
    },
    {
      id: 'onb-14',
      name: 'Apresentar ao time',
      description: 'Gestor apresenta o novo colaborador a equipe e define buddy/mentor.',
      department: 'Gestao',
      type: 'task',
      sla_hours: 8,
      depends_on: ['onb-04', 'onb-05', 'onb-06', 'onb-07'],
    },
    {
      id: 'onb-15',
      name: 'Confirmar onboarding concluido',
      description: 'RH confirma que todas as etapas foram concluidas e o colaborador esta operacional.',
      department: 'RH',
      assignee_team: 'RH - Admissao',
      type: 'task',
      sla_hours: 48,
      depends_on: ['onb-03', 'onb-04', 'onb-05', 'onb-06', 'onb-07', 'onb-08', 'onb-09', 'onb-10', 'onb-11', 'onb-12', 'onb-13', 'onb-14'],
      notifications: [
        { channel: 'email', to: 'gestor', template: 'onboarding_concluido' },
        { channel: 'system', to: 'rh-admissao', template: 'onboarding_concluido' },
      ],
    },
  ],
  transitions: [
    { from: 'onb-01', to: 'onb-02', label: 'Perfil criado' },
    { from: 'onb-02', to: 'onb-03', label: 'Aprovado - provisionar e-mail' },
    { from: 'onb-02', to: 'onb-04', label: 'Aprovado - provisionar notebook' },
    { from: 'onb-02', to: 'onb-06', label: 'Aprovado - preparar posto' },
    { from: 'onb-02', to: 'onb-08', label: 'Aprovado - cadastrar beneficios' },
    { from: 'onb-02', to: 'onb-10', label: 'Aprovado - agendar integracao' },
    { from: 'onb-02', to: 'onb-12', label: 'Aprovado - enviar kit' },
    { from: 'onb-03', to: 'onb-05', label: 'E-mail criado' },
    { from: 'onb-06', to: 'onb-07', label: 'Posto pronto' },
    { from: 'onb-06', to: 'onb-13', label: 'Posto pronto - configurar ramal' },
    { from: 'onb-10', to: 'onb-11', label: 'Integracao agendada' },
    { from: 'onb-01', to: 'onb-09', label: 'Perfil criado - config folha' },
    { from: 'onb-14', to: 'onb-15', label: 'Colaborador apresentado' },
  ],
};

// ---------------------------------------------------------------------------
// 2. Offboarding de Colaborador (10 steps)
// ---------------------------------------------------------------------------

export const offboardingWorkflow: ESMWorkflowDefinition = {
  id: 'wf-offboarding',
  name: 'Offboarding de Colaborador',
  description: 'Fluxo completo de desligamento envolvendo RH, TI, Facilities, Financeiro e Juridico.',
  version: 1,
  trigger_template: 'hr-desligamento',
  steps: [
    {
      id: 'off-01',
      name: 'Iniciar processo de desligamento',
      description: 'RH registra o desligamento e notifica todos os departamentos envolvidos.',
      department: 'RH',
      assignee_team: 'RH - Desligamento',
      type: 'task',
      sla_hours: 4,
      depends_on: [],
      notifications: [
        { channel: 'email', to: 'ti-acessos', template: 'desligamento_iniciado' },
        { channel: 'email', to: 'facilities', template: 'desligamento_iniciado' },
        { channel: 'email', to: 'financeiro', template: 'desligamento_iniciado' },
        { channel: 'email', to: 'juridico', template: 'desligamento_iniciado' },
      ],
    },
    {
      id: 'off-02',
      name: 'Revogar acessos logicos',
      description: 'TI desativa e-mail, VPN, ERP, CRM e todos os acessos a sistemas.',
      department: 'TI',
      assignee_team: 'Operacoes - Acessos',
      type: 'task',
      sla_hours: 4,
      depends_on: ['off-01'],
    },
    {
      id: 'off-03',
      name: 'Recolher equipamentos',
      description: 'TI recolhe notebook, monitor, perifericos e celular corporativo.',
      department: 'TI',
      assignee_team: 'Operacoes - Patrimonio',
      type: 'task',
      sla_hours: 8,
      depends_on: ['off-01'],
    },
    {
      id: 'off-04',
      name: 'Calcular rescisao',
      description: 'Financeiro calcula verbas rescisorias, ferias proporcionais e 13o.',
      department: 'Financeiro',
      assignee_team: 'Financeiro - Folha',
      type: 'task',
      sla_hours: 48,
      depends_on: ['off-01'],
    },
    {
      id: 'off-05',
      name: 'Preparar documentacao juridica',
      description: 'Juridico prepara TRCT, homologacao e documentos de rescisao.',
      department: 'Juridico',
      assignee_team: 'Juridico - Trabalhista',
      type: 'task',
      sla_hours: 48,
      depends_on: ['off-04'],
    },
    {
      id: 'off-06',
      name: 'Revogar acesso fisico',
      description: 'Facilities bloqueia cracha e revoga acesso as dependencias.',
      department: 'Facilities',
      assignee_team: 'Facilities - Seguranca',
      type: 'task',
      sla_hours: 4,
      depends_on: ['off-01'],
    },
    {
      id: 'off-07',
      name: 'Liberar posto de trabalho',
      description: 'Facilities libera mesa, ramal e espaco para realocacao.',
      department: 'Facilities',
      assignee_team: 'Facilities - Espacos',
      type: 'task',
      sla_hours: 24,
      depends_on: ['off-03'],
    },
    {
      id: 'off-08',
      name: 'Cancelar beneficios',
      description: 'RH cancela plano de saude, odontologico, VR, VT e demais beneficios.',
      department: 'RH',
      assignee_team: 'RH - Beneficios',
      type: 'task',
      sla_hours: 24,
      depends_on: ['off-01'],
    },
    {
      id: 'off-09',
      name: 'Realizar entrevista de desligamento',
      description: 'RH conduz entrevista de desligamento para feedback e melhoria continua.',
      department: 'RH',
      assignee_team: 'RH - Desligamento',
      type: 'task',
      sla_hours: 40,
      depends_on: ['off-01'],
    },
    {
      id: 'off-10',
      name: 'Confirmar offboarding concluido',
      description: 'RH verifica que todas as etapas foram cumpridas e encerra o processo.',
      department: 'RH',
      assignee_team: 'RH - Desligamento',
      type: 'task',
      sla_hours: 8,
      depends_on: ['off-02', 'off-03', 'off-04', 'off-05', 'off-06', 'off-07', 'off-08', 'off-09'],
      notifications: [
        { channel: 'email', to: 'gestor', template: 'offboarding_concluido' },
        { channel: 'system', to: 'rh-desligamento', template: 'offboarding_concluido' },
      ],
    },
  ],
  transitions: [
    { from: 'off-01', to: 'off-02', label: 'Desligamento registrado - revogar acessos' },
    { from: 'off-01', to: 'off-03', label: 'Desligamento registrado - recolher equipamentos' },
    { from: 'off-01', to: 'off-04', label: 'Desligamento registrado - calcular rescisao' },
    { from: 'off-01', to: 'off-06', label: 'Desligamento registrado - revogar acesso fisico' },
    { from: 'off-01', to: 'off-08', label: 'Desligamento registrado - cancelar beneficios' },
    { from: 'off-01', to: 'off-09', label: 'Desligamento registrado - entrevista' },
    { from: 'off-04', to: 'off-05', label: 'Rescisao calculada' },
    { from: 'off-03', to: 'off-07', label: 'Equipamentos recolhidos' },
    { from: 'off-09', to: 'off-10', label: 'Todas as etapas concluidas' },
  ],
};

// ---------------------------------------------------------------------------
// 3. Processo de Compra (8 steps)
// ---------------------------------------------------------------------------

export const purchaseWorkflow: ESMWorkflowDefinition = {
  id: 'wf-compra',
  name: 'Processo de Compra',
  description: 'Fluxo completo de compra com cotacao, aprovacao hierarquica e pagamento.',
  version: 1,
  trigger_template: 'fin-compra',
  steps: [
    {
      id: 'cmp-01',
      name: 'Registrar pedido de compra',
      description: 'Solicitante registra o pedido com especificacoes e justificativa.',
      department: 'Solicitante',
      type: 'task',
      sla_hours: 2,
      depends_on: [],
    },
    {
      id: 'cmp-02',
      name: 'Aprovacao do gestor',
      description: 'Gestor direto do solicitante aprova o pedido de compra.',
      department: 'Gestao',
      type: 'approval',
      sla_hours: 24,
      depends_on: ['cmp-01'],
      notifications: [{ channel: 'email', to: 'gestor', template: 'aprovacao_compra' }],
    },
    {
      id: 'cmp-03',
      name: 'Validar orcamento',
      description: 'Financeiro verifica disponibilidade de orcamento no centro de custo.',
      department: 'Financeiro',
      assignee_team: 'Financeiro - Controladoria',
      type: 'task',
      sla_hours: 16,
      depends_on: ['cmp-02'],
    },
    {
      id: 'cmp-04',
      name: 'Realizar cotacao',
      description: 'Compras solicita no minimo 3 cotacoes de fornecedores.',
      department: 'Financeiro',
      assignee_team: 'Financeiro - Compras',
      type: 'task',
      sla_hours: 72,
      depends_on: ['cmp-03'],
    },
    {
      id: 'cmp-05',
      name: 'Aprovacao da diretoria',
      description: 'Compras acima de R$ 5.000 necessitam aprovacao da diretoria.',
      department: 'Diretoria',
      type: 'approval',
      sla_hours: 48,
      depends_on: ['cmp-04'],
      condition: { field: 'valor_estimado', operator: 'gt', value: 5000 },
      notifications: [{ channel: 'email', to: 'diretoria', template: 'aprovacao_compra_diretoria' }],
    },
    {
      id: 'cmp-06',
      name: 'Efetuar compra',
      description: 'Compras efetua o pedido com o fornecedor selecionado.',
      department: 'Financeiro',
      assignee_team: 'Financeiro - Compras',
      type: 'task',
      sla_hours: 24,
      depends_on: ['cmp-05'],
    },
    {
      id: 'cmp-07',
      name: 'Registrar nota fiscal',
      description: 'Financeiro registra a nota fiscal e efetua o pagamento.',
      department: 'Financeiro',
      assignee_team: 'Financeiro - Contas a Pagar',
      type: 'task',
      sla_hours: 24,
      depends_on: ['cmp-06'],
    },
    {
      id: 'cmp-08',
      name: 'Confirmar recebimento',
      description: 'Solicitante confirma o recebimento do material ou servico.',
      department: 'Solicitante',
      type: 'task',
      sla_hours: 48,
      depends_on: ['cmp-07'],
      notifications: [
        { channel: 'email', to: 'solicitante', template: 'confirmar_recebimento' },
        { channel: 'system', to: 'compras', template: 'compra_concluida' },
      ],
    },
  ],
  transitions: [
    { from: 'cmp-01', to: 'cmp-02', label: 'Pedido registrado' },
    { from: 'cmp-02', to: 'cmp-03', label: 'Aprovado pelo gestor' },
    { from: 'cmp-03', to: 'cmp-04', label: 'Orcamento validado' },
    { from: 'cmp-04', to: 'cmp-05', label: 'Cotacao concluida' },
    { from: 'cmp-05', to: 'cmp-06', label: 'Aprovado pela diretoria' },
    { from: 'cmp-04', to: 'cmp-06', label: 'Valor <= R$ 5.000 (sem diretoria)', condition: { field: 'valor_estimado', operator: 'lt', value: 5001 } },
    { from: 'cmp-06', to: 'cmp-07', label: 'Compra efetuada' },
    { from: 'cmp-07', to: 'cmp-08', label: 'NF registrada' },
  ],
};

// ---------------------------------------------------------------------------
// All workflow definitions
// ---------------------------------------------------------------------------

export const ESM_WORKFLOW_DEFINITIONS: ESMWorkflowDefinition[] = [
  onboardingWorkflow,
  offboardingWorkflow,
  purchaseWorkflow,
];

export function getWorkflowDefinitionById(id: string): ESMWorkflowDefinition | undefined {
  return ESM_WORKFLOW_DEFINITIONS.find((w) => w.id === id);
}
