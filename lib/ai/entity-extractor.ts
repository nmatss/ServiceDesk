/**
 * Entity Extractor for Conversational Portal
 * Extracts structured entities from Portuguese natural language messages
 */

export interface ExtractedEntities {
  category?: string;
  urgency?: string;
  service?: string;
  error_message?: string;
  affected_users?: string;
  since_when?: string;
  raw_intent?: string;
}

interface KeywordMapping {
  keywords: string[];
  value: string;
}

const CATEGORY_MAPPINGS: KeywordMapping[] = [
  { keywords: ['email', 'e-mail', 'outlook', 'correio', 'caixa de entrada', 'smtp', 'imap'], value: 'Email' },
  { keywords: ['impressora', 'imprimir', 'impressão', 'scanner', 'toner', 'papel', 'monitor', 'teclado', 'mouse', 'hardware', 'equipamento', 'notebook', 'computador', 'pc', 'máquina'], value: 'Hardware' },
  { keywords: ['sistema', 'software', 'aplicativo', 'programa', 'app', 'aplicação', 'instalar', 'instalação', 'atualizar', 'atualização', 'versão', 'bug', 'erro no sistema', 'tela azul', 'travando'], value: 'Software' },
  { keywords: ['rede', 'internet', 'wifi', 'wi-fi', 'conexão', 'conectar', 'vpn', 'dns', 'firewall', 'proxy', 'banda', 'caiu a rede', 'sem internet', 'desconectado'], value: 'Rede' },
  { keywords: ['acesso', 'login', 'senha', 'permissão', 'bloqueado', 'bloqueio', 'desbloqueio', 'desbloqueado', 'autenticação', 'credencial', 'token', 'sso', 'conta', 'usuário novo', 'criar conta', 'resetar senha', 'esqueci a senha'], value: 'Acesso' },
  { keywords: ['lento', 'lentidão', 'performance', 'desempenho', 'demora', 'demorado', 'carregando', 'travado', 'congelou', 'memória', 'cpu', 'disco cheio', 'espaço'], value: 'Performance' },
  { keywords: ['telefone', 'ramal', 'voip', 'ligação', 'telefonia', 'headset'], value: 'Telefonia' },
  { keywords: ['backup', 'restaurar', 'recuperar', 'arquivo perdido', 'deletado', 'apagado'], value: 'Backup' },
  { keywords: ['segurança', 'vírus', 'malware', 'phishing', 'spam', 'invasão', 'ataque', 'ransomware', 'suspeito'], value: 'Segurança' },
];

const URGENCY_HIGH_KEYWORDS = [
  'urgente', 'urgência', 'crítico', 'crítica', 'parou', 'parado', 'emergência',
  'todos parados', 'empresa parada', 'produção parada', 'não funciona nada',
  'caiu tudo', 'fora do ar', 'indisponível', 'impossível trabalhar',
  'perdendo dados', 'imediatamente', 'agora', 'socorro',
];

const URGENCY_LOW_KEYWORDS = [
  'quando puder', 'baixa prioridade', 'sem pressa', 'não urgente',
  'quando tiver tempo', 'pode ser depois', 'tranquilo', 'sem urgência',
  'melhoria', 'sugestão', 'gostaria', 'seria bom',
];

const SERVICE_KEYWORDS: KeywordMapping[] = [
  { keywords: ['erp', 'sap', 'totvs', 'protheus'], value: 'ERP' },
  { keywords: ['crm', 'salesforce', 'hubspot', 'pipedrive'], value: 'CRM' },
  { keywords: ['outlook', 'exchange', 'microsoft 365', 'office 365', 'office', 'word', 'excel', 'powerpoint', 'teams'], value: 'Microsoft 365' },
  { keywords: ['google workspace', 'gmail', 'google drive', 'google docs', 'google sheets'], value: 'Google Workspace' },
  { keywords: ['zoom', 'meet', 'webex', 'videoconferência', 'videochamada'], value: 'Videoconferência' },
  { keywords: ['jira', 'confluence', 'bitbucket', 'atlassian'], value: 'Atlassian' },
  { keywords: ['slack', 'discord'], value: 'Comunicação' },
  { keywords: ['aws', 'azure', 'gcp', 'nuvem', 'cloud'], value: 'Cloud' },
  { keywords: ['windows', 'linux', 'macos', 'mac'], value: 'Sistema Operacional' },
];

export class EntityExtractor {
  /**
   * Extract structured entities from a Portuguese natural language message
   */
  extract(text: string): ExtractedEntities {
    const normalized = text.toLowerCase().trim();
    const entities: ExtractedEntities = {};

    entities.category = this.extractCategory(normalized);
    entities.urgency = this.extractUrgency(normalized);
    entities.service = this.extractService(normalized);
    entities.error_message = this.extractErrorMessage(text);
    entities.affected_users = this.extractAffectedUsers(normalized);
    entities.since_when = this.extractSinceWhen(normalized);
    entities.raw_intent = this.extractIntent(normalized);

    // Remove undefined fields
    return Object.fromEntries(
      Object.entries(entities).filter(([, v]) => v !== undefined)
    ) as ExtractedEntities;
  }

  private extractCategory(text: string): string | undefined {
    for (const mapping of CATEGORY_MAPPINGS) {
      for (const keyword of mapping.keywords) {
        if (text.includes(keyword)) {
          return mapping.value;
        }
      }
    }
    return undefined;
  }

  private extractUrgency(text: string): string | undefined {
    for (const keyword of URGENCY_HIGH_KEYWORDS) {
      if (text.includes(keyword)) {
        return 'high';
      }
    }
    for (const keyword of URGENCY_LOW_KEYWORDS) {
      if (text.includes(keyword)) {
        return 'low';
      }
    }
    return undefined;
  }

  private extractService(text: string): string | undefined {
    for (const mapping of SERVICE_KEYWORDS) {
      for (const keyword of mapping.keywords) {
        if (text.includes(keyword)) {
          return mapping.value;
        }
      }
    }
    return undefined;
  }

  private extractErrorMessage(text: string): string | undefined {
    // Match text in quotes
    const quoteMatch = text.match(/[""]([^""]+)[""]|"([^"]+)"/);
    if (quoteMatch) {
      return quoteMatch[1] || quoteMatch[2];
    }

    // Match text after "erro:" or "mensagem de erro:"
    const errorMatch = text.match(/(?:erro|error|mensagem de erro|msg de erro)\s*:?\s*(.+?)(?:\.|$)/i);
    if (errorMatch) {
      return errorMatch[1].trim();
    }

    return undefined;
  }

  private extractAffectedUsers(text: string): string | undefined {
    // Match patterns like "5 pessoas", "toda a equipe", "10 usuários"
    const numberMatch = text.match(/(\d+)\s*(?:pessoa|pessoas|usuário|usuários|colaborador|colaboradores|funcionário|funcionários|user|users)/);
    if (numberMatch) {
      return numberMatch[0];
    }

    // Qualitative matches
    const qualitativePatterns = [
      'toda a equipe', 'todo o setor', 'toda a empresa', 'todos',
      'departamento inteiro', 'equipe inteira', 'vários usuários',
      'alguns colegas', 'meu time', 'nossa equipe',
    ];
    for (const pattern of qualitativePatterns) {
      if (text.includes(pattern)) {
        return pattern;
      }
    }

    // "só eu" / "apenas eu"
    if (text.includes('só eu') || text.includes('apenas eu') || text.includes('somente eu')) {
      return '1 pessoa';
    }

    return undefined;
  }

  private extractSinceWhen(text: string): string | undefined {
    const timePatterns = [
      /desde\s+(ontem|hoje|segunda|terça|quarta|quinta|sexta|sábado|domingo)/,
      /desde\s+(?:as?\s+)?(\d{1,2}(?::\d{2})?(?:\s*(?:h|horas?))?)/,
      /(?:há|faz)\s+(\d+)\s*(?:dia|dias|hora|horas|minuto|minutos|semana|semanas)/,
      /(?:começou|iniciou|aconteceu)\s+(ontem|hoje|agora|de manhã|à tarde|à noite)/,
      /(?:manhã|tarde|noite)\s+(?:de\s+)?(ontem|hoje|segunda|terça|quarta|quinta|sexta)/,
      /(?:ontem|hoje|agora pouco|agora mesmo|esta manhã|esta tarde)/,
    ];

    for (const pattern of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return undefined;
  }

  private extractIntent(text: string): string | undefined {
    const intents: KeywordMapping[] = [
      { keywords: ['não consigo', 'não funciona', 'não está funcionando', 'parou de funcionar', 'deu problema', 'está com problema', 'quebrou'], value: 'problema_funcionamento' },
      { keywords: ['preciso de acesso', 'liberar acesso', 'solicitar acesso', 'criar conta', 'novo usuário'], value: 'solicitar_acesso' },
      { keywords: ['instalar', 'instalação', 'preciso do', 'preciso instalar'], value: 'instalacao' },
      { keywords: ['trocar', 'substituir', 'novo equipamento', 'equipamento novo'], value: 'substituicao' },
      { keywords: ['dúvida', 'como faz', 'como faço', 'me ajuda', 'ajuda com'], value: 'duvida' },
      { keywords: ['resetar senha', 'esqueci a senha', 'trocar senha', 'nova senha', 'redefinir senha'], value: 'reset_senha' },
    ];

    for (const mapping of intents) {
      for (const keyword of mapping.keywords) {
        if (text.includes(keyword)) {
          return mapping.value;
        }
      }
    }

    return undefined;
  }
}

export const entityExtractor = new EntityExtractor();
