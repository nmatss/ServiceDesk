/**
 * ESM (Enterprise Service Management) Workspace Templates
 *
 * Pre-built department workspace definitions for multi-department service management.
 * Extends beyond IT to HR, Finance, Legal, Facilities, and Operations.
 * All content in Portuguese (pt-BR) for Brazilian companies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ESMDepartment = 'hr' | 'finance' | 'legal' | 'facilities' | 'operations' | 'it';

export interface ESMField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'email' | 'file' | 'checkbox';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface ESMTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  fields: ESMField[];
  auto_assign_team?: string;
}

export interface ESMWorkflow {
  id: string;
  name: string;
  description: string;
  steps: number;
  trigger_template?: string;
}

export interface ESMSlaDefault {
  priority: string;
  response_hours: number;
  resolution_hours: number;
}

export interface ESMCategory {
  name: string;
  description: string;
  icon: string;
}

export interface ESMWorkspace {
  id: string;
  name: string;
  department: ESMDepartment;
  icon: string;
  color: string;
  description: string;
  categories: ESMCategory[];
  templates: ESMTemplate[];
  workflows: ESMWorkflow[];
  sla_defaults: ESMSlaDefault[];
}

// ---------------------------------------------------------------------------
// RH (HR) Workspace
// ---------------------------------------------------------------------------

const hrWorkspace: ESMWorkspace = {
  id: 'ws-hr',
  name: 'Recursos Humanos',
  department: 'hr',
  icon: 'UsersIcon',
  color: 'purple',
  description: 'Gestao de pessoas, admissao, desligamento, beneficios, folha de pagamento e treinamentos.',
  categories: [
    { name: 'Admissao', description: 'Processos de contratacao e integracao de novos colaboradores', icon: 'UserPlusIcon' },
    { name: 'Desligamento', description: 'Processos de rescisao e offboarding', icon: 'UserMinusIcon' },
    { name: 'Ferias e Licencas', description: 'Solicitacoes de ferias, licencas e afastamentos', icon: 'CalendarDaysIcon' },
    { name: 'Beneficios', description: 'Plano de saude, vale-refeicao, vale-transporte e outros beneficios', icon: 'GiftIcon' },
    { name: 'Folha de Pagamento', description: 'Duvidas e correcoes relacionadas ao holerite', icon: 'BanknotesIcon' },
    { name: 'Treinamento', description: 'Capacitacao, cursos e desenvolvimento profissional', icon: 'AcademicCapIcon' },
    { name: 'Avaliacao', description: 'Avaliacao de desempenho, feedback e plano de carreira', icon: 'ClipboardDocumentCheckIcon' },
  ],
  templates: [
    {
      id: 'hr-admissao',
      name: 'Solicitacao de Admissao',
      description: 'Solicitar a contratacao de um novo colaborador com todas as informacoes necessarias para o processo admissional.',
      category: 'Admissao',
      priority: 'high',
      auto_assign_team: 'RH - Admissao',
      fields: [
        { name: 'nome_colaborador', label: 'Nome Completo do Candidato', type: 'text', required: true, placeholder: 'Nome completo conforme documento' },
        { name: 'cpf', label: 'CPF', type: 'text', required: true, placeholder: '000.000.000-00' },
        { name: 'cargo', label: 'Cargo', type: 'text', required: true, placeholder: 'Ex: Analista de Sistemas Pleno' },
        { name: 'departamento', label: 'Departamento', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Juridico', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo'] },
        { name: 'data_inicio', label: 'Data de Inicio', type: 'date', required: true },
        { name: 'tipo_contrato', label: 'Tipo de Contrato', type: 'select', required: true, options: ['CLT', 'PJ', 'Estagio', 'Temporario', 'Aprendiz'] },
        { name: 'salario', label: 'Salario Proposto (R$)', type: 'number', required: true, placeholder: 'Valor bruto mensal' },
        { name: 'gestor_responsavel', label: 'Gestor Responsavel', type: 'text', required: true, placeholder: 'Nome do gestor direto' },
        { name: 'email_gestor', label: 'E-mail do Gestor', type: 'email', required: true },
        { name: 'justificativa', label: 'Justificativa da Contratacao', type: 'textarea', required: true, placeholder: 'Motivo da abertura da vaga e necessidade da contratacao' },
        { name: 'requisitos', label: 'Requisitos da Vaga', type: 'textarea', required: false, placeholder: 'Formacao, experiencia, habilidades' },
        { name: 'beneficios_especiais', label: 'Beneficios Especiais', type: 'textarea', required: false, placeholder: 'Beneficios adicionais ao padrao' },
      ],
    },
    {
      id: 'hr-desligamento',
      name: 'Solicitacao de Desligamento',
      description: 'Iniciar o processo de desligamento de um colaborador.',
      category: 'Desligamento',
      priority: 'high',
      auto_assign_team: 'RH - Desligamento',
      fields: [
        { name: 'nome_colaborador', label: 'Nome do Colaborador', type: 'text', required: true },
        { name: 'matricula', label: 'Matricula', type: 'text', required: true },
        { name: 'departamento', label: 'Departamento', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Juridico', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo'] },
        { name: 'tipo_desligamento', label: 'Tipo de Desligamento', type: 'select', required: true, options: ['Demissao sem justa causa', 'Demissao por justa causa', 'Pedido de demissao', 'Acordo mutuo', 'Fim de contrato'] },
        { name: 'data_desligamento', label: 'Data Prevista', type: 'date', required: true },
        { name: 'cumpre_aviso', label: 'Cumprira Aviso Previo?', type: 'select', required: true, options: ['Sim - trabalhado', 'Sim - indenizado', 'Nao - dispensa'] },
        { name: 'gestor_responsavel', label: 'Gestor Responsavel', type: 'text', required: true },
        { name: 'motivo', label: 'Motivo do Desligamento', type: 'textarea', required: true, placeholder: 'Descreva o motivo detalhadamente' },
      ],
    },
    {
      id: 'hr-ferias',
      name: 'Pedido de Ferias',
      description: 'Solicitar periodo de ferias ou programar ferias futuras.',
      category: 'Ferias e Licencas',
      priority: 'medium',
      auto_assign_team: 'RH - Beneficios',
      fields: [
        { name: 'nome_colaborador', label: 'Nome do Colaborador', type: 'text', required: true },
        { name: 'matricula', label: 'Matricula', type: 'text', required: true },
        { name: 'periodo_aquisitivo', label: 'Periodo Aquisitivo', type: 'text', required: true, placeholder: 'Ex: 01/2025 a 01/2026' },
        { name: 'data_inicio', label: 'Data de Inicio das Ferias', type: 'date', required: true },
        { name: 'data_fim', label: 'Data de Retorno', type: 'date', required: true },
        { name: 'dias', label: 'Quantidade de Dias', type: 'select', required: true, options: ['30 dias', '20 dias + 10 abono', '15 dias (1o periodo)', '15 dias (2o periodo)', '10 dias'] },
        { name: 'abono_pecuniario', label: 'Deseja Abono Pecuniario?', type: 'select', required: true, options: ['Sim', 'Nao'] },
        { name: 'adiantamento_13', label: 'Adiantamento de 13o?', type: 'select', required: true, options: ['Sim', 'Nao'] },
        { name: 'observacoes', label: 'Observacoes', type: 'textarea', required: false },
      ],
    },
    {
      id: 'hr-beneficios',
      name: 'Alteracao de Beneficios',
      description: 'Solicitar inclusao, exclusao ou alteracao de beneficios do colaborador.',
      category: 'Beneficios',
      priority: 'medium',
      auto_assign_team: 'RH - Beneficios',
      fields: [
        { name: 'nome_colaborador', label: 'Nome do Colaborador', type: 'text', required: true },
        { name: 'matricula', label: 'Matricula', type: 'text', required: true },
        { name: 'tipo_alteracao', label: 'Tipo de Alteracao', type: 'select', required: true, options: ['Inclusao', 'Exclusao', 'Alteracao de plano', 'Inclusao de dependente', 'Exclusao de dependente'] },
        { name: 'beneficio', label: 'Beneficio', type: 'select', required: true, options: ['Plano de Saude', 'Plano Odontologico', 'Vale-Refeicao', 'Vale-Alimentacao', 'Vale-Transporte', 'Seguro de Vida', 'Previdencia Privada', 'Auxilio-Creche', 'Gympass'] },
        { name: 'detalhes', label: 'Detalhes da Alteracao', type: 'textarea', required: true, placeholder: 'Descreva a alteracao desejada' },
        { name: 'nome_dependente', label: 'Nome do Dependente (se aplicavel)', type: 'text', required: false },
        { name: 'cpf_dependente', label: 'CPF do Dependente (se aplicavel)', type: 'text', required: false },
        { name: 'comprovante', label: 'Documento Comprobatorio', type: 'file', required: false },
      ],
    },
    {
      id: 'hr-holerite',
      name: 'Duvida sobre Holerite',
      description: 'Esclarecer duvidas sobre contracheque, descontos ou proventos.',
      category: 'Folha de Pagamento',
      priority: 'low',
      auto_assign_team: 'RH - Folha',
      fields: [
        { name: 'nome_colaborador', label: 'Nome do Colaborador', type: 'text', required: true },
        { name: 'matricula', label: 'Matricula', type: 'text', required: true },
        { name: 'mes_referencia', label: 'Mes de Referencia', type: 'text', required: true, placeholder: 'Ex: Janeiro/2026' },
        { name: 'tipo_duvida', label: 'Tipo de Duvida', type: 'select', required: true, options: ['Desconto indevido', 'Valor divergente', 'Falta de pagamento', 'Horas extras', 'Adicional noturno', 'Ferias', '13o salario', 'Outro'] },
        { name: 'descricao', label: 'Descricao Detalhada', type: 'textarea', required: true, placeholder: 'Descreva a duvida com o maximo de detalhes' },
        { name: 'comprovante', label: 'Print do Holerite', type: 'file', required: false },
      ],
    },
    {
      id: 'hr-treinamento',
      name: 'Solicitacao de Treinamento',
      description: 'Solicitar participacao em treinamento, curso ou certificacao.',
      category: 'Treinamento',
      priority: 'low',
      auto_assign_team: 'RH - Treinamento',
      fields: [
        { name: 'nome_colaborador', label: 'Nome do Colaborador', type: 'text', required: true },
        { name: 'departamento', label: 'Departamento', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Juridico', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo'] },
        { name: 'nome_treinamento', label: 'Nome do Treinamento/Curso', type: 'text', required: true },
        { name: 'instituicao', label: 'Instituicao/Fornecedor', type: 'text', required: true },
        { name: 'modalidade', label: 'Modalidade', type: 'select', required: true, options: ['Presencial', 'Online ao vivo', 'Online gravado', 'Hibrido', 'In-company'] },
        { name: 'data_inicio', label: 'Data de Inicio', type: 'date', required: true },
        { name: 'data_fim', label: 'Data de Termino', type: 'date', required: false },
        { name: 'carga_horaria', label: 'Carga Horaria (horas)', type: 'number', required: true },
        { name: 'custo', label: 'Custo Estimado (R$)', type: 'number', required: true },
        { name: 'justificativa', label: 'Justificativa', type: 'textarea', required: true, placeholder: 'Como este treinamento beneficiara suas atividades?' },
        { name: 'aprovacao_gestor', label: 'Gestor Aprova?', type: 'select', required: true, options: ['Sim', 'Pendente'] },
      ],
    },
    {
      id: 'hr-cadastral',
      name: 'Atualizacao Cadastral',
      description: 'Atualizar dados pessoais como endereco, telefone, estado civil, etc.',
      category: 'Admissao',
      priority: 'low',
      auto_assign_team: 'RH - Cadastro',
      fields: [
        { name: 'nome_colaborador', label: 'Nome do Colaborador', type: 'text', required: true },
        { name: 'matricula', label: 'Matricula', type: 'text', required: true },
        { name: 'tipo_atualizacao', label: 'O que deseja atualizar?', type: 'select', required: true, options: ['Endereco', 'Telefone', 'Estado civil', 'Dependentes', 'Dados bancarios', 'Nome (pos-casamento)', 'Outro'] },
        { name: 'dados_atuais', label: 'Dados Atuais', type: 'textarea', required: true },
        { name: 'dados_novos', label: 'Dados Novos', type: 'textarea', required: true },
        { name: 'comprovante', label: 'Comprovante', type: 'file', required: true },
      ],
    },
    {
      id: 'hr-atestado',
      name: 'Solicitacao de Atestado/Declaracao',
      description: 'Solicitar atestado de vinculo, declaracao de rendimentos ou outros documentos.',
      category: 'Folha de Pagamento',
      priority: 'low',
      auto_assign_team: 'RH - Cadastro',
      fields: [
        { name: 'nome_colaborador', label: 'Nome do Colaborador', type: 'text', required: true },
        { name: 'matricula', label: 'Matricula', type: 'text', required: true },
        { name: 'tipo_documento', label: 'Tipo de Documento', type: 'select', required: true, options: ['Declaracao de vinculo empregaticio', 'Declaracao de rendimentos', 'Informe de rendimentos (IRPF)', 'Carta de recomendacao', 'Atestado de trabalho', 'Outro'] },
        { name: 'finalidade', label: 'Finalidade', type: 'text', required: true, placeholder: 'Ex: Financiamento imobiliario, processo judicial' },
        { name: 'prazo', label: 'Prazo de Entrega Necessario', type: 'date', required: false },
        { name: 'observacoes', label: 'Observacoes', type: 'textarea', required: false },
      ],
    },
  ],
  workflows: [
    { id: 'wf-onboarding', name: 'Onboarding de Colaborador', description: 'Fluxo completo de admissao com 15 etapas envolvendo RH, TI, Facilities e Financeiro', steps: 15, trigger_template: 'hr-admissao' },
    { id: 'wf-offboarding', name: 'Offboarding de Colaborador', description: 'Fluxo completo de desligamento com 10 etapas', steps: 10, trigger_template: 'hr-desligamento' },
  ],
  sla_defaults: [
    { priority: 'critical', response_hours: 2, resolution_hours: 8 },
    { priority: 'high', response_hours: 4, resolution_hours: 24 },
    { priority: 'medium', response_hours: 8, resolution_hours: 48 },
    { priority: 'low', response_hours: 24, resolution_hours: 120 },
  ],
};

// ---------------------------------------------------------------------------
// Financeiro (Finance) Workspace
// ---------------------------------------------------------------------------

const financeWorkspace: ESMWorkspace = {
  id: 'ws-finance',
  name: 'Financeiro',
  department: 'finance',
  icon: 'BanknotesIcon',
  color: 'emerald',
  description: 'Reembolsos, pagamentos, compras, orcamento, fiscal e contabilidade.',
  categories: [
    { name: 'Reembolso', description: 'Reembolso de despesas corporativas e viagens', icon: 'ReceiptRefundIcon' },
    { name: 'Pagamentos', description: 'Solicitacoes de pagamento a fornecedores e prestadores', icon: 'CreditCardIcon' },
    { name: 'Compras', description: 'Pedidos de compra de materiais e servicos', icon: 'ShoppingCartIcon' },
    { name: 'Orcamento', description: 'Aprovacao e consulta de orcamento departamental', icon: 'CalculatorIcon' },
    { name: 'Fiscal', description: 'Emissao de notas fiscais e questoes tributarias', icon: 'DocumentTextIcon' },
    { name: 'Contabilidade', description: 'Lancamentos contabeis, conciliacao e relatorios', icon: 'ChartBarIcon' },
  ],
  templates: [
    {
      id: 'fin-reembolso',
      name: 'Solicitacao de Reembolso',
      description: 'Solicitar reembolso de despesas realizadas a servico da empresa.',
      category: 'Reembolso',
      priority: 'medium',
      auto_assign_team: 'Financeiro - Contas a Pagar',
      fields: [
        { name: 'nome_solicitante', label: 'Nome do Solicitante', type: 'text', required: true },
        { name: 'departamento', label: 'Departamento', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Juridico', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo'] },
        { name: 'tipo_despesa', label: 'Tipo de Despesa', type: 'select', required: true, options: ['Transporte/Uber', 'Alimentacao', 'Hospedagem', 'Material de escritorio', 'Curso/Treinamento', 'Telefonia', 'Equipamento', 'Outro'] },
        { name: 'valor', label: 'Valor Total (R$)', type: 'number', required: true },
        { name: 'data_despesa', label: 'Data da Despesa', type: 'date', required: true },
        { name: 'centro_custo', label: 'Centro de Custo', type: 'text', required: true, placeholder: 'Ex: CC-001' },
        { name: 'descricao', label: 'Descricao da Despesa', type: 'textarea', required: true },
        { name: 'nota_fiscal', label: 'Nota Fiscal / Cupom', type: 'file', required: true },
        { name: 'comprovante_pagamento', label: 'Comprovante de Pagamento', type: 'file', required: false },
        { name: 'aprovador', label: 'Gestor Aprovador', type: 'text', required: true },
      ],
    },
    {
      id: 'fin-pagamento',
      name: 'Solicitacao de Pagamento',
      description: 'Solicitar pagamento a fornecedor ou prestador de servicos.',
      category: 'Pagamentos',
      priority: 'medium',
      auto_assign_team: 'Financeiro - Contas a Pagar',
      fields: [
        { name: 'fornecedor', label: 'Nome do Fornecedor', type: 'text', required: true },
        { name: 'cnpj_fornecedor', label: 'CNPJ do Fornecedor', type: 'text', required: true, placeholder: '00.000.000/0000-00' },
        { name: 'valor', label: 'Valor (R$)', type: 'number', required: true },
        { name: 'data_vencimento', label: 'Data de Vencimento', type: 'date', required: true },
        { name: 'forma_pagamento', label: 'Forma de Pagamento', type: 'select', required: true, options: ['Boleto', 'Transferencia bancaria (TED)', 'PIX', 'Cartao corporativo', 'Cheque'] },
        { name: 'centro_custo', label: 'Centro de Custo', type: 'text', required: true },
        { name: 'numero_contrato', label: 'Numero do Contrato (se aplicavel)', type: 'text', required: false },
        { name: 'nota_fiscal', label: 'Nota Fiscal', type: 'file', required: true },
        { name: 'boleto', label: 'Boleto / Dados Bancarios', type: 'file', required: false },
        { name: 'descricao', label: 'Descricao do Servico/Produto', type: 'textarea', required: true },
        { name: 'aprovador', label: 'Aprovador', type: 'text', required: true },
      ],
    },
    {
      id: 'fin-compra',
      name: 'Pedido de Compra',
      description: 'Solicitar a aquisicao de materiais, equipamentos ou servicos.',
      category: 'Compras',
      priority: 'medium',
      auto_assign_team: 'Financeiro - Compras',
      fields: [
        { name: 'descricao_item', label: 'Descricao do Item/Servico', type: 'textarea', required: true, placeholder: 'Descreva detalhadamente o que precisa ser adquirido' },
        { name: 'quantidade', label: 'Quantidade', type: 'number', required: true },
        { name: 'valor_estimado', label: 'Valor Estimado (R$)', type: 'number', required: true },
        { name: 'centro_custo', label: 'Centro de Custo', type: 'text', required: true },
        { name: 'urgencia', label: 'Urgencia', type: 'select', required: true, options: ['Baixa - pode aguardar', 'Media - 15 dias', 'Alta - 5 dias', 'Critica - imediato'] },
        { name: 'fornecedor_sugerido', label: 'Fornecedor Sugerido', type: 'text', required: false },
        { name: 'justificativa', label: 'Justificativa', type: 'textarea', required: true },
        { name: 'aprovador', label: 'Gestor Aprovador', type: 'text', required: true },
        { name: 'cotacao', label: 'Cotacao (se disponivel)', type: 'file', required: false },
      ],
    },
    {
      id: 'fin-orcamento',
      name: 'Aprovacao de Orcamento',
      description: 'Solicitar aprovacao ou revisao de orcamento departamental.',
      category: 'Orcamento',
      priority: 'high',
      auto_assign_team: 'Financeiro - Controladoria',
      fields: [
        { name: 'departamento', label: 'Departamento', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Juridico', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo'] },
        { name: 'tipo_solicitacao', label: 'Tipo de Solicitacao', type: 'select', required: true, options: ['Aprovacao de orcamento anual', 'Revisao de orcamento', 'Suplementacao de verba', 'Transferencia entre centros de custo'] },
        { name: 'valor_atual', label: 'Orcamento Atual (R$)', type: 'number', required: true },
        { name: 'valor_solicitado', label: 'Valor Solicitado (R$)', type: 'number', required: true },
        { name: 'periodo', label: 'Periodo de Referencia', type: 'text', required: true, placeholder: 'Ex: Q1 2026' },
        { name: 'justificativa', label: 'Justificativa Detalhada', type: 'textarea', required: true },
        { name: 'planilha', label: 'Planilha de Orcamento', type: 'file', required: false },
      ],
    },
    {
      id: 'fin-nf',
      name: 'Emissao de Nota Fiscal',
      description: 'Solicitar emissao de nota fiscal de servico ou produto.',
      category: 'Fiscal',
      priority: 'medium',
      auto_assign_team: 'Financeiro - Fiscal',
      fields: [
        { name: 'tipo_nf', label: 'Tipo de NF', type: 'select', required: true, options: ['NFS-e (Servicos)', 'NF-e (Produtos)', 'NFC-e (Consumidor)', 'Nota de debito', 'Nota de credito'] },
        { name: 'cliente', label: 'Razao Social do Cliente', type: 'text', required: true },
        { name: 'cnpj_cliente', label: 'CNPJ/CPF do Cliente', type: 'text', required: true },
        { name: 'valor', label: 'Valor (R$)', type: 'number', required: true },
        { name: 'descricao_servico', label: 'Descricao do Servico/Produto', type: 'textarea', required: true },
        { name: 'codigo_servico', label: 'Codigo do Servico (LC 116)', type: 'text', required: false },
        { name: 'retencoes', label: 'Retencoes Aplicaveis', type: 'select', required: false, options: ['ISS', 'IRRF', 'PIS/COFINS/CSLL', 'INSS', 'Nenhuma'] },
        { name: 'observacoes', label: 'Observacoes', type: 'textarea', required: false },
      ],
    },
    {
      id: 'fin-consulta',
      name: 'Consulta Financeira',
      description: 'Esclarecer duvidas sobre processos financeiros, pagamentos ou relatorios.',
      category: 'Contabilidade',
      priority: 'low',
      auto_assign_team: 'Financeiro - Atendimento',
      fields: [
        { name: 'nome_solicitante', label: 'Nome do Solicitante', type: 'text', required: true },
        { name: 'departamento', label: 'Departamento', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Juridico', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo'] },
        { name: 'assunto', label: 'Assunto', type: 'select', required: true, options: ['Status de pagamento', 'Relatorio financeiro', 'Centro de custo', 'Orcamento disponivel', 'Conciliacao bancaria', 'Outro'] },
        { name: 'descricao', label: 'Descricao da Duvida', type: 'textarea', required: true },
        { name: 'anexo', label: 'Documento de Referencia', type: 'file', required: false },
      ],
    },
    {
      id: 'fin-adiantamento',
      name: 'Adiantamento de Viagem',
      description: 'Solicitar adiantamento financeiro para viagem corporativa.',
      category: 'Reembolso',
      priority: 'medium',
      auto_assign_team: 'Financeiro - Contas a Pagar',
      fields: [
        { name: 'nome_viajante', label: 'Nome do Viajante', type: 'text', required: true },
        { name: 'destino', label: 'Destino', type: 'text', required: true },
        { name: 'data_ida', label: 'Data de Ida', type: 'date', required: true },
        { name: 'data_volta', label: 'Data de Volta', type: 'date', required: true },
        { name: 'motivo_viagem', label: 'Motivo da Viagem', type: 'textarea', required: true },
        { name: 'valor_estimado', label: 'Valor Estimado (R$)', type: 'number', required: true },
        { name: 'itens_previstos', label: 'Itens de Despesa Previstos', type: 'textarea', required: true, placeholder: 'Hospedagem, transporte, alimentacao, etc.' },
        { name: 'centro_custo', label: 'Centro de Custo', type: 'text', required: true },
        { name: 'aprovador', label: 'Gestor Aprovador', type: 'text', required: true },
      ],
    },
  ],
  workflows: [
    { id: 'wf-compra', name: 'Processo de Compra', description: 'Fluxo de compra com cotacao, aprovacao e pagamento', steps: 8, trigger_template: 'fin-compra' },
  ],
  sla_defaults: [
    { priority: 'critical', response_hours: 2, resolution_hours: 4 },
    { priority: 'high', response_hours: 4, resolution_hours: 16 },
    { priority: 'medium', response_hours: 8, resolution_hours: 48 },
    { priority: 'low', response_hours: 24, resolution_hours: 72 },
  ],
};

// ---------------------------------------------------------------------------
// Juridico (Legal) Workspace
// ---------------------------------------------------------------------------

const legalWorkspace: ESMWorkspace = {
  id: 'ws-legal',
  name: 'Juridico',
  department: 'legal',
  icon: 'ScaleIcon',
  color: 'amber',
  description: 'Contratos, compliance, LGPD, questoes trabalhistas, societarias e propriedade intelectual.',
  categories: [
    { name: 'Contratos', description: 'Elaboracao, revisao e gestao de contratos', icon: 'DocumentDuplicateIcon' },
    { name: 'Compliance', description: 'Denuncias, politicas internas e conformidade regulatoria', icon: 'ShieldCheckIcon' },
    { name: 'LGPD', description: 'Protecao de dados pessoais e privacidade', icon: 'LockClosedIcon' },
    { name: 'Trabalhista', description: 'Questoes juridicas trabalhistas e previdenciarias', icon: 'BriefcaseIcon' },
    { name: 'Societario', description: 'Atos societarios, procuracoes e registros', icon: 'BuildingOffice2Icon' },
    { name: 'Propriedade Intelectual', description: 'Registro de marcas, patentes e direitos autorais', icon: 'FingerPrintIcon' },
  ],
  templates: [
    {
      id: 'leg-contrato',
      name: 'Revisao de Contrato',
      description: 'Solicitar revisao juridica de contrato antes da assinatura.',
      category: 'Contratos',
      priority: 'high',
      auto_assign_team: 'Juridico - Contratos',
      fields: [
        { name: 'tipo_contrato', label: 'Tipo de Contrato', type: 'select', required: true, options: ['Prestacao de servicos', 'Fornecimento', 'Licenciamento de software', 'Locacao', 'Parceria comercial', 'Trabalho (CLT)', 'Confidencialidade (NDA)', 'SLA', 'Outro'] },
        { name: 'contraparte', label: 'Nome da Contraparte', type: 'text', required: true },
        { name: 'cnpj_contraparte', label: 'CNPJ/CPF da Contraparte', type: 'text', required: true },
        { name: 'valor_contrato', label: 'Valor do Contrato (R$)', type: 'number', required: true },
        { name: 'vigencia', label: 'Vigencia', type: 'select', required: true, options: ['6 meses', '12 meses', '24 meses', '36 meses', 'Indeterminado', 'Por projeto'] },
        { name: 'prazo_revisao', label: 'Prazo para Revisao', type: 'date', required: true },
        { name: 'departamento_solicitante', label: 'Departamento Solicitante', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo'] },
        { name: 'resumo', label: 'Resumo do Objeto', type: 'textarea', required: true },
        { name: 'pontos_atencao', label: 'Pontos de Atencao', type: 'textarea', required: false, placeholder: 'Clausulas especificas que precisam de atencao' },
        { name: 'minuta', label: 'Minuta do Contrato', type: 'file', required: true },
        { name: 'anexos', label: 'Documentos Complementares', type: 'file', required: false },
      ],
    },
    {
      id: 'leg-nda',
      name: 'Solicitacao de NDA',
      description: 'Solicitar elaboracao de Acordo de Confidencialidade (NDA).',
      category: 'Contratos',
      priority: 'medium',
      auto_assign_team: 'Juridico - Contratos',
      fields: [
        { name: 'contraparte', label: 'Nome da Contraparte', type: 'text', required: true },
        { name: 'cnpj_contraparte', label: 'CNPJ/CPF', type: 'text', required: true },
        { name: 'tipo_nda', label: 'Tipo de NDA', type: 'select', required: true, options: ['Unilateral', 'Bilateral (Mutuo)'] },
        { name: 'finalidade', label: 'Finalidade', type: 'textarea', required: true, placeholder: 'Descreva o proposito do NDA' },
        { name: 'vigencia', label: 'Vigencia da Confidencialidade', type: 'select', required: true, options: ['1 ano', '2 anos', '3 anos', '5 anos', 'Indeterminado'] },
        { name: 'informacoes_confidenciais', label: 'Tipo de Informacoes Confidenciais', type: 'textarea', required: true },
        { name: 'prazo', label: 'Prazo de Entrega', type: 'date', required: true },
      ],
    },
    {
      id: 'leg-consulta',
      name: 'Consulta Juridica',
      description: 'Solicitar parecer ou orientacao juridica sobre assuntos diversos.',
      category: 'Contratos',
      priority: 'medium',
      auto_assign_team: 'Juridico - Consultivo',
      fields: [
        { name: 'departamento', label: 'Departamento Solicitante', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo', 'Diretoria'] },
        { name: 'area_juridica', label: 'Area Juridica', type: 'select', required: true, options: ['Contratual', 'Trabalhista', 'Tributario', 'Regulatorio', 'Consumidor', 'Societario', 'Propriedade Intelectual', 'LGPD', 'Outro'] },
        { name: 'urgencia_legal', label: 'Nivel de Urgencia', type: 'select', required: true, options: ['Informativo - sem prazo', 'Normal - 10 dias uteis', 'Urgente - 3 dias uteis', 'Emergencial - 24 horas'] },
        { name: 'descricao', label: 'Descricao da Questao', type: 'textarea', required: true, placeholder: 'Descreva a situacao e a duvida juridica' },
        { name: 'documentos', label: 'Documentos Relacionados', type: 'file', required: false },
      ],
    },
    {
      id: 'leg-compliance',
      name: 'Denuncia de Compliance',
      description: 'Reportar violacao de politicas internas, codigo de etica ou regulamentacoes.',
      category: 'Compliance',
      priority: 'critical',
      auto_assign_team: 'Juridico - Compliance',
      fields: [
        { name: 'tipo_denuncia', label: 'Tipo de Denuncia', type: 'select', required: true, options: ['Fraude', 'Corrupcao', 'Assedio moral', 'Assedio sexual', 'Discriminacao', 'Conflito de interesses', 'Vazamento de informacoes', 'Descumprimento de politica', 'Outro'] },
        { name: 'anonimo', label: 'Deseja manter anonimato?', type: 'select', required: true, options: ['Sim', 'Nao'] },
        { name: 'descricao', label: 'Descricao dos Fatos', type: 'textarea', required: true, placeholder: 'Descreva o ocorrido com o maximo de detalhes: o que, quando, onde, quem' },
        { name: 'envolvidos', label: 'Pessoas Envolvidas', type: 'textarea', required: false, placeholder: 'Nomes e cargos, se conhecidos' },
        { name: 'data_ocorrencia', label: 'Data (Aproximada) da Ocorrencia', type: 'date', required: false },
        { name: 'evidencias', label: 'Evidencias', type: 'file', required: false },
      ],
    },
    {
      id: 'leg-lgpd',
      name: 'Solicitacao LGPD',
      description: 'Exercer direitos de titular de dados pessoais conforme a LGPD.',
      category: 'LGPD',
      priority: 'high',
      auto_assign_team: 'Juridico - LGPD',
      fields: [
        { name: 'tipo_solicitacao', label: 'Tipo de Solicitacao', type: 'select', required: true, options: ['Confirmacao de tratamento', 'Acesso aos dados', 'Correcao de dados', 'Anonimizacao/bloqueio', 'Eliminacao de dados', 'Portabilidade', 'Revogacao de consentimento', 'Oposicao ao tratamento'] },
        { name: 'nome_titular', label: 'Nome do Titular', type: 'text', required: true },
        { name: 'cpf_titular', label: 'CPF do Titular', type: 'text', required: true },
        { name: 'email_titular', label: 'E-mail do Titular', type: 'email', required: true },
        { name: 'detalhes', label: 'Detalhes da Solicitacao', type: 'textarea', required: true },
        { name: 'documento_identidade', label: 'Documento de Identidade', type: 'file', required: true },
      ],
    },
    {
      id: 'leg-marca',
      name: 'Registro de Marca',
      description: 'Solicitar registro de marca, patente ou direito autoral.',
      category: 'Propriedade Intelectual',
      priority: 'medium',
      auto_assign_team: 'Juridico - PI',
      fields: [
        { name: 'tipo_registro', label: 'Tipo de Registro', type: 'select', required: true, options: ['Marca', 'Patente', 'Direito autoral', 'Desenho industrial', 'Software'] },
        { name: 'nome_marca', label: 'Nome/Titulo', type: 'text', required: true },
        { name: 'descricao', label: 'Descricao', type: 'textarea', required: true },
        { name: 'classe_nice', label: 'Classe NICE (para marcas)', type: 'text', required: false, placeholder: 'Ex: Classe 9, 42' },
        { name: 'logotipo', label: 'Logotipo/Imagem', type: 'file', required: false },
        { name: 'documentos', label: 'Documentos de Suporte', type: 'file', required: false },
        { name: 'urgencia', label: 'Urgencia', type: 'select', required: true, options: ['Normal', 'Urgente - concorrente pode registrar'] },
      ],
    },
  ],
  workflows: [],
  sla_defaults: [
    { priority: 'critical', response_hours: 1, resolution_hours: 4 },
    { priority: 'high', response_hours: 4, resolution_hours: 24 },
    { priority: 'medium', response_hours: 8, resolution_hours: 80 },
    { priority: 'low', response_hours: 24, resolution_hours: 160 },
  ],
};

// ---------------------------------------------------------------------------
// Facilities Workspace
// ---------------------------------------------------------------------------

const facilitiesWorkspace: ESMWorkspace = {
  id: 'ws-facilities',
  name: 'Facilities',
  department: 'facilities',
  icon: 'BuildingOfficeIcon',
  color: 'sky',
  description: 'Manutencao predial, limpeza, seguranca, reserva de espacos, equipamentos e transporte.',
  categories: [
    { name: 'Manutencao', description: 'Manutencao preventiva e corretiva de instalacoes', icon: 'WrenchScrewdriverIcon' },
    { name: 'Limpeza', description: 'Servicos de limpeza e higienizacao', icon: 'SparklesIcon' },
    { name: 'Seguranca', description: 'Controle de acesso, CFTV e seguranca patrimonial', icon: 'ShieldCheckIcon' },
    { name: 'Espacos', description: 'Reserva de salas, auditorio e espacos compartilhados', icon: 'RectangleGroupIcon' },
    { name: 'Equipamentos', description: 'Mobiliario e equipamentos de escritorio', icon: 'CubeIcon' },
    { name: 'Transporte', description: 'Fretado, estacionamento e logistica interna', icon: 'TruckIcon' },
  ],
  templates: [
    {
      id: 'fac-manutencao',
      name: 'Solicitacao de Manutencao',
      description: 'Reportar problema ou solicitar manutencao em instalacoes da empresa.',
      category: 'Manutencao',
      priority: 'medium',
      auto_assign_team: 'Facilities - Manutencao',
      fields: [
        { name: 'tipo_manutencao', label: 'Tipo de Manutencao', type: 'select', required: true, options: ['Eletrica', 'Hidraulica', 'Ar-condicionado', 'Pintura', 'Marcenaria', 'Vidracaria', 'Elevador', 'Rede/Cabeamento', 'Outro'] },
        { name: 'local', label: 'Unidade/Predio', type: 'text', required: true },
        { name: 'andar', label: 'Andar', type: 'select', required: true, options: ['Terreo', '1o andar', '2o andar', '3o andar', '4o andar', '5o andar', 'Subsolo', 'Cobertura'] },
        { name: 'sala', label: 'Sala/Ambiente', type: 'text', required: true, placeholder: 'Ex: Sala 301, Copa, Banheiro masculino' },
        { name: 'descricao', label: 'Descricao do Problema', type: 'textarea', required: true },
        { name: 'urgencia', label: 'Urgencia', type: 'select', required: true, options: ['Baixa - pode agendar', 'Media - esta semana', 'Alta - hoje', 'Emergencia - risco a seguranca'] },
        { name: 'foto', label: 'Foto do Problema', type: 'file', required: false },
        { name: 'melhor_horario', label: 'Melhor Horario para Manutencao', type: 'select', required: false, options: ['Horario comercial', 'Apos expediente', 'Final de semana', 'Qualquer horario'] },
      ],
    },
    {
      id: 'fac-sala',
      name: 'Reserva de Sala',
      description: 'Reservar sala de reuniao, auditorio ou espaco compartilhado.',
      category: 'Espacos',
      priority: 'low',
      auto_assign_team: 'Facilities - Espacos',
      fields: [
        { name: 'tipo_espaco', label: 'Tipo de Espaco', type: 'select', required: true, options: ['Sala de reuniao pequena (4p)', 'Sala de reuniao media (8p)', 'Sala de reuniao grande (16p)', 'Auditorio', 'Espaco de convivencia', 'Sala de treinamento'] },
        { name: 'data', label: 'Data', type: 'date', required: true },
        { name: 'horario_inicio', label: 'Horario de Inicio', type: 'text', required: true, placeholder: 'Ex: 14:00' },
        { name: 'horario_fim', label: 'Horario de Termino', type: 'text', required: true, placeholder: 'Ex: 16:00' },
        { name: 'participantes', label: 'Numero de Participantes', type: 'number', required: true },
        { name: 'recursos', label: 'Recursos Necessarios', type: 'select', required: false, options: ['Projetor', 'Videoconferencia', 'Quadro branco', 'Coffee break', 'Microfone', 'Gravacao'] },
        { name: 'recorrencia', label: 'Recorrencia', type: 'select', required: false, options: ['Unica vez', 'Semanal', 'Quinzenal', 'Mensal'] },
        { name: 'observacoes', label: 'Observacoes', type: 'textarea', required: false },
      ],
    },
    {
      id: 'fac-mudanca',
      name: 'Mudanca de Posto',
      description: 'Solicitar mudanca de posto de trabalho, mobiliario ou layout.',
      category: 'Espacos',
      priority: 'low',
      auto_assign_team: 'Facilities - Espacos',
      fields: [
        { name: 'nome_colaborador', label: 'Nome do Colaborador', type: 'text', required: true },
        { name: 'local_atual', label: 'Local Atual', type: 'text', required: true, placeholder: 'Ex: 3o andar, Sala 305, Posicao 12' },
        { name: 'local_destino', label: 'Local Desejado', type: 'text', required: true, placeholder: 'Ex: 4o andar, Sala 401, Posicao 8' },
        { name: 'motivo', label: 'Motivo da Mudanca', type: 'textarea', required: true },
        { name: 'data_desejada', label: 'Data Desejada', type: 'date', required: true },
        { name: 'itens_transportar', label: 'Itens para Transportar', type: 'textarea', required: false, placeholder: 'Equipamentos, arquivos, mobiliario pessoal' },
        { name: 'necessita_ti', label: 'Necessita Suporte de TI?', type: 'select', required: true, options: ['Sim - reconfigurar rede/telefone', 'Nao'] },
      ],
    },
    {
      id: 'fac-limpeza',
      name: 'Pedido de Limpeza',
      description: 'Solicitar servico de limpeza extraordinaria ou higienizacao.',
      category: 'Limpeza',
      priority: 'low',
      auto_assign_team: 'Facilities - Limpeza',
      fields: [
        { name: 'tipo_servico', label: 'Tipo de Servico', type: 'select', required: true, options: ['Limpeza geral', 'Limpeza de carpete', 'Higienizacao de banheiro', 'Limpeza de vidros', 'Desinfeccao', 'Coleta de lixo extra', 'Dedetizacao'] },
        { name: 'local', label: 'Local', type: 'text', required: true },
        { name: 'andar', label: 'Andar', type: 'text', required: true },
        { name: 'urgencia', label: 'Urgencia', type: 'select', required: true, options: ['Programada', 'Hoje', 'Imediato'] },
        { name: 'descricao', label: 'Descricao', type: 'textarea', required: false },
        { name: 'foto', label: 'Foto', type: 'file', required: false },
      ],
    },
    {
      id: 'fac-acesso',
      name: 'Controle de Acesso',
      description: 'Solicitar liberacao, bloqueio ou alteracao de acesso fisico.',
      category: 'Seguranca',
      priority: 'medium',
      auto_assign_team: 'Facilities - Seguranca',
      fields: [
        { name: 'tipo_solicitacao', label: 'Tipo de Solicitacao', type: 'select', required: true, options: ['Liberacao de acesso', 'Bloqueio de acesso', 'Emissao de cracha', '2a via de cracha', 'Acesso temporario (visitante)', 'Alteracao de horario'] },
        { name: 'nome_pessoa', label: 'Nome da Pessoa', type: 'text', required: true },
        { name: 'cpf', label: 'CPF', type: 'text', required: true },
        { name: 'empresa', label: 'Empresa (se terceiro)', type: 'text', required: false },
        { name: 'areas', label: 'Areas de Acesso', type: 'textarea', required: true, placeholder: 'Ex: Recepcao, 3o andar, CPD, Estacionamento' },
        { name: 'periodo', label: 'Periodo', type: 'select', required: true, options: ['Permanente', '1 dia', '1 semana', '1 mes', 'Personalizado'] },
        { name: 'data_inicio', label: 'Data de Inicio', type: 'date', required: true },
        { name: 'data_fim', label: 'Data de Fim (se temporario)', type: 'date', required: false },
        { name: 'foto', label: 'Foto 3x4 (para cracha)', type: 'file', required: false },
      ],
    },
    {
      id: 'fac-equipamento',
      name: 'Pedido de Equipamento de Escritorio',
      description: 'Solicitar mobiliario ou equipamentos para o escritorio.',
      category: 'Equipamentos',
      priority: 'low',
      auto_assign_team: 'Facilities - Compras',
      fields: [
        { name: 'tipo_equipamento', label: 'Tipo de Equipamento', type: 'select', required: true, options: ['Cadeira', 'Mesa', 'Apoio de pe', 'Suporte de monitor', 'Luminaria', 'Armario/gaveteiro', 'Quadro branco', 'Lixeira', 'Outro'] },
        { name: 'quantidade', label: 'Quantidade', type: 'number', required: true },
        { name: 'local_entrega', label: 'Local de Entrega', type: 'text', required: true },
        { name: 'justificativa', label: 'Justificativa', type: 'textarea', required: true },
        { name: 'ergonomico', label: 'Necessidade Ergonomica?', type: 'select', required: false, options: ['Sim - laudo medico', 'Sim - preventivo', 'Nao'] },
        { name: 'laudo', label: 'Laudo Medico (se aplicavel)', type: 'file', required: false },
      ],
    },
    {
      id: 'fac-predial',
      name: 'Reporte de Problema Predial',
      description: 'Reportar problema urgente nas instalacoes do predio.',
      category: 'Manutencao',
      priority: 'high',
      auto_assign_team: 'Facilities - Manutencao',
      fields: [
        { name: 'tipo_problema', label: 'Tipo de Problema', type: 'select', required: true, options: ['Vazamento de agua', 'Falta de energia', 'Elevador parado', 'Ar-condicionado', 'Infiltracao', 'Porta/fechadura', 'Alarme de incendio', 'Cheiro de gas', 'Outro'] },
        { name: 'local', label: 'Local Exato', type: 'text', required: true },
        { name: 'andar', label: 'Andar', type: 'text', required: true },
        { name: 'gravidade', label: 'Gravidade', type: 'select', required: true, options: ['Baixa - inconveniente', 'Media - impacta trabalho', 'Alta - risco de dano material', 'Critica - risco a seguranca de pessoas'] },
        { name: 'descricao', label: 'Descricao Detalhada', type: 'textarea', required: true },
        { name: 'foto', label: 'Fotos', type: 'file', required: false },
        { name: 'pessoas_afetadas', label: 'Numero de Pessoas Afetadas', type: 'number', required: false },
      ],
    },
  ],
  workflows: [],
  sla_defaults: [
    { priority: 'critical', response_hours: 0.5, resolution_hours: 2 },
    { priority: 'high', response_hours: 1, resolution_hours: 8 },
    { priority: 'medium', response_hours: 4, resolution_hours: 24 },
    { priority: 'low', response_hours: 8, resolution_hours: 72 },
  ],
};

// ---------------------------------------------------------------------------
// Operacoes (Operations) Workspace
// ---------------------------------------------------------------------------

const operationsWorkspace: ESMWorkspace = {
  id: 'ws-operations',
  name: 'Operacoes',
  department: 'operations',
  icon: 'CogIcon',
  color: 'indigo',
  description: 'Equipamentos de TI, acessos, provisionamento, inventario, infraestrutura e suporte geral.',
  categories: [
    { name: 'Equipamentos TI', description: 'Notebooks, desktops, perifericos e acessorios', icon: 'ComputerDesktopIcon' },
    { name: 'Acessos', description: 'VPN, sistemas, e-mail e permissoes', icon: 'KeyIcon' },
    { name: 'Provisionamento', description: 'Configuracao de ambientes e infraestrutura', icon: 'ServerIcon' },
    { name: 'Inventario', description: 'Controle de ativos e patrimonio de TI', icon: 'ClipboardDocumentListIcon' },
    { name: 'Infraestrutura', description: 'Rede, servidores, cloud e telecomunicacoes', icon: 'ServerStackIcon' },
    { name: 'Suporte Geral', description: 'Atendimento geral de TI e operacoes', icon: 'LifebuoyIcon' },
  ],
  templates: [
    {
      id: 'ops-notebook',
      name: 'Pedido de Notebook',
      description: 'Solicitar novo notebook ou substituicao do equipamento atual.',
      category: 'Equipamentos TI',
      priority: 'medium',
      auto_assign_team: 'Operacoes - Hardware',
      fields: [
        { name: 'nome_usuario', label: 'Nome do Usuario', type: 'text', required: true },
        { name: 'departamento', label: 'Departamento', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Juridico', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo', 'Diretoria'] },
        { name: 'motivo', label: 'Motivo', type: 'select', required: true, options: ['Novo colaborador', 'Substituicao por defeito', 'Upgrade', 'Projeto especifico', 'Perda/roubo'] },
        { name: 'tipo_equipamento', label: 'Perfil de Uso', type: 'select', required: true, options: ['Basico (Office, navegacao)', 'Intermediario (multitarefas)', 'Avancado (desenvolvimento)', 'Alto desempenho (design/video)', 'Portatil leve (viagens)'] },
        { name: 'softwares', label: 'Softwares Necessarios', type: 'textarea', required: false, placeholder: 'Liste os softwares que precisam ser instalados' },
        { name: 'data_necessidade', label: 'Data de Necessidade', type: 'date', required: true },
        { name: 'justificativa', label: 'Justificativa', type: 'textarea', required: true },
        { name: 'aprovador', label: 'Gestor Aprovador', type: 'text', required: true },
        { name: 'patrimonio_anterior', label: 'Patrimonio do Equipamento Anterior (se substituicao)', type: 'text', required: false },
      ],
    },
    {
      id: 'ops-vpn',
      name: 'Solicitacao de Acesso VPN',
      description: 'Solicitar acesso remoto via VPN corporativa.',
      category: 'Acessos',
      priority: 'medium',
      auto_assign_team: 'Operacoes - Seguranca',
      fields: [
        { name: 'nome_usuario', label: 'Nome do Usuario', type: 'text', required: true },
        { name: 'email', label: 'E-mail Corporativo', type: 'email', required: true },
        { name: 'departamento', label: 'Departamento', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Juridico', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo'] },
        { name: 'tipo_acesso', label: 'Tipo de Acesso', type: 'select', required: true, options: ['VPN Full Tunnel', 'VPN Split Tunnel', 'Acesso a sistemas especificos'] },
        { name: 'sistemas', label: 'Sistemas que Precisa Acessar', type: 'textarea', required: true, placeholder: 'Ex: ERP, CRM, servidor de arquivos' },
        { name: 'periodo', label: 'Periodo', type: 'select', required: true, options: ['Permanente', 'Temporario - 1 mes', 'Temporario - 3 meses', 'Temporario - 6 meses'] },
        { name: 'justificativa', label: 'Justificativa', type: 'textarea', required: true },
        { name: 'aprovador', label: 'Gestor Aprovador', type: 'text', required: true },
      ],
    },
    {
      id: 'ops-ambiente',
      name: 'Provisionamento de Ambiente',
      description: 'Solicitar criacao ou configuracao de ambiente de desenvolvimento, homologacao ou producao.',
      category: 'Provisionamento',
      priority: 'high',
      auto_assign_team: 'Operacoes - Infra',
      fields: [
        { name: 'nome_projeto', label: 'Nome do Projeto', type: 'text', required: true },
        { name: 'tipo_ambiente', label: 'Tipo de Ambiente', type: 'select', required: true, options: ['Desenvolvimento', 'Homologacao/QA', 'Pre-producao (staging)', 'Producao'] },
        { name: 'stack_tecnologica', label: 'Stack Tecnologica', type: 'textarea', required: true, placeholder: 'Ex: Node.js 20, PostgreSQL 16, Redis, Nginx' },
        { name: 'recursos', label: 'Recursos Necessarios', type: 'textarea', required: true, placeholder: 'CPU, memoria, disco, banda' },
        { name: 'plataforma', label: 'Plataforma', type: 'select', required: true, options: ['AWS', 'Azure', 'GCP', 'On-premise', 'Docker local', 'Kubernetes'] },
        { name: 'prazo', label: 'Data de Necessidade', type: 'date', required: true },
        { name: 'responsavel_tecnico', label: 'Responsavel Tecnico', type: 'text', required: true },
        { name: 'aprovador', label: 'Gestor Aprovador', type: 'text', required: true },
      ],
    },
    {
      id: 'ops-devolucao',
      name: 'Devolucao de Equipamento',
      description: 'Registrar devolucao de equipamento de TI (notebook, monitor, periferico).',
      category: 'Inventario',
      priority: 'low',
      auto_assign_team: 'Operacoes - Patrimonio',
      fields: [
        { name: 'nome_usuario', label: 'Nome do Usuario', type: 'text', required: true },
        { name: 'tipo_equipamento', label: 'Tipo de Equipamento', type: 'select', required: true, options: ['Notebook', 'Desktop', 'Monitor', 'Teclado', 'Mouse', 'Headset', 'Webcam', 'Docking station', 'Celular corporativo', 'Outro'] },
        { name: 'patrimonio', label: 'Numero de Patrimonio', type: 'text', required: true },
        { name: 'numero_serie', label: 'Numero de Serie', type: 'text', required: false },
        { name: 'estado_conservacao', label: 'Estado de Conservacao', type: 'select', required: true, options: ['Excelente', 'Bom', 'Regular', 'Ruim - com defeito'] },
        { name: 'motivo', label: 'Motivo da Devolucao', type: 'select', required: true, options: ['Desligamento', 'Substituicao', 'Ferias prolongadas', 'Transferencia', 'Equipamento sem uso'] },
        { name: 'observacoes', label: 'Observacoes', type: 'textarea', required: false },
      ],
    },
    {
      id: 'ops-monitor',
      name: 'Pedido de Monitor',
      description: 'Solicitar monitor adicional ou substituicao de monitor.',
      category: 'Equipamentos TI',
      priority: 'low',
      auto_assign_team: 'Operacoes - Hardware',
      fields: [
        { name: 'nome_usuario', label: 'Nome do Usuario', type: 'text', required: true },
        { name: 'departamento', label: 'Departamento', type: 'select', required: true, options: ['TI', 'RH', 'Financeiro', 'Juridico', 'Operacoes', 'Comercial', 'Marketing', 'Administrativo'] },
        { name: 'tipo', label: 'Tipo de Solicitacao', type: 'select', required: true, options: ['Monitor adicional (2o monitor)', 'Substituicao de monitor com defeito', 'Monitor ultrawide', 'Monitor para apresentacao'] },
        { name: 'tamanho_preferido', label: 'Tamanho Preferido', type: 'select', required: false, options: ['24 polegadas', '27 polegadas', '32 polegadas', '34 polegadas (ultrawide)', 'Sem preferencia'] },
        { name: 'justificativa', label: 'Justificativa', type: 'textarea', required: true },
        { name: 'local_entrega', label: 'Local de Entrega', type: 'text', required: true },
        { name: 'aprovador', label: 'Gestor Aprovador', type: 'text', required: true },
      ],
    },
    {
      id: 'ops-software',
      name: 'Solicitacao de Software',
      description: 'Solicitar instalacao ou licenca de software.',
      category: 'Acessos',
      priority: 'medium',
      auto_assign_team: 'Operacoes - Software',
      fields: [
        { name: 'nome_usuario', label: 'Nome do Usuario', type: 'text', required: true },
        { name: 'nome_software', label: 'Nome do Software', type: 'text', required: true },
        { name: 'versao', label: 'Versao Necessaria', type: 'text', required: false },
        { name: 'tipo_licenca', label: 'Tipo de Licenca', type: 'select', required: true, options: ['Gratuito/Open-source', 'Licenca individual', 'Licenca corporativa (ja temos)', 'Precisa adquirir'] },
        { name: 'custo_estimado', label: 'Custo Estimado (R$)', type: 'number', required: false },
        { name: 'justificativa', label: 'Justificativa', type: 'textarea', required: true, placeholder: 'Como este software sera utilizado nas suas atividades?' },
        { name: 'alternativas', label: 'Alternativas Avaliadas', type: 'textarea', required: false, placeholder: 'Outros softwares considerados e motivos de descarte' },
        { name: 'aprovador', label: 'Gestor Aprovador', type: 'text', required: true },
      ],
    },
  ],
  workflows: [],
  sla_defaults: [
    { priority: 'critical', response_hours: 1, resolution_hours: 4 },
    { priority: 'high', response_hours: 2, resolution_hours: 8 },
    { priority: 'medium', response_hours: 4, resolution_hours: 24 },
    { priority: 'low', response_hours: 8, resolution_hours: 48 },
  ],
};

// ---------------------------------------------------------------------------
// Exported registry
// ---------------------------------------------------------------------------

export const ESM_WORKSPACES: ESMWorkspace[] = [
  hrWorkspace,
  financeWorkspace,
  legalWorkspace,
  facilitiesWorkspace,
  operationsWorkspace,
];

/**
 * Look up a workspace by id or department slug.
 */
export function getWorkspaceById(id: string): ESMWorkspace | undefined {
  return ESM_WORKSPACES.find((w) => w.id === id);
}

export function getWorkspaceByDepartment(dept: ESMDepartment): ESMWorkspace | undefined {
  return ESM_WORKSPACES.find((w) => w.department === dept);
}

/**
 * Look up a template within a workspace.
 */
export function getTemplateById(workspaceId: string, templateId: string): ESMTemplate | undefined {
  const ws = getWorkspaceById(workspaceId);
  return ws?.templates.find((t) => t.id === templateId);
}
