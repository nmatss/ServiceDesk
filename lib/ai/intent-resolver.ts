/**
 * Intent Resolver for Autonomous AI Agent
 *
 * Detects user intent from ticket title and description using keyword matching
 * and category analysis. No external AI dependency — runs entirely locally for speed.
 * Supports Portuguese (pt-BR) keywords.
 */

import { logger } from '@/lib/monitoring/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const INTENT_TYPES = [
  'password_reset',
  'account_unlock',
  'access_request',
  'software_install',
  'information_query',
  'troubleshooting',
  'status_inquiry',
  'other',
] as const;

export type IntentType = (typeof INTENT_TYPES)[number];

export interface Intent {
  type: IntentType;
  confidence: number; // 0–100
  entities: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Keyword maps (Portuguese + English)
// ---------------------------------------------------------------------------

interface KeywordRule {
  keywords: string[];
  /** Extra boost when keyword appears in the title (vs. description) */
  titleBoost: number;
  /** Base weight when keyword is found */
  weight: number;
}

const INTENT_KEYWORDS: Record<IntentType, KeywordRule> = {
  password_reset: {
    keywords: [
      'senha', 'password', 'redefinir senha', 'trocar senha', 'esqueci senha',
      'reset password', 'resetar senha', 'alterar senha', 'nova senha',
      'recuperar senha', 'forgot password', 'mudar senha',
    ],
    titleBoost: 15,
    weight: 12,
  },
  account_unlock: {
    keywords: [
      'desbloquear', 'bloqueado', 'conta bloqueada', 'unlock', 'locked',
      'account locked', 'desbloqueio', 'trancado', 'travado',
      'não consigo entrar', 'não consigo acessar minha conta',
    ],
    titleBoost: 15,
    weight: 12,
  },
  access_request: {
    keywords: [
      'acesso', 'permissão', 'autorização', 'liberar acesso', 'solicitar acesso',
      'access request', 'permission', 'grant access', 'novo acesso',
      'habilitar', 'compartilhar', 'compartilhamento', 'vpn', 'remote access',
    ],
    titleBoost: 12,
    weight: 10,
  },
  software_install: {
    keywords: [
      'instalar', 'instalação', 'software', 'programa', 'aplicativo', 'app',
      'install', 'download', 'atualizar', 'atualização', 'update', 'upgrade',
      'licença', 'license', 'versão', 'plugin', 'extensão',
    ],
    titleBoost: 12,
    weight: 10,
  },
  information_query: {
    keywords: [
      'como', 'onde', 'qual', 'quando', 'informação', 'dúvida', 'pergunta',
      'how to', 'where', 'what', 'information', 'help', 'ajuda',
      'manual', 'documentação', 'tutorial', 'procedimento', 'guia',
    ],
    titleBoost: 8,
    weight: 7,
  },
  troubleshooting: {
    keywords: [
      'erro', 'error', 'falha', 'bug', 'problema', 'não funciona', 'travando',
      'lento', 'crash', 'tela azul', 'congelando', 'reiniciando',
      'not working', 'broken', 'failed', 'issue', 'defeito', 'intermitente',
    ],
    titleBoost: 10,
    weight: 9,
  },
  status_inquiry: {
    keywords: [
      'status', 'andamento', 'previsão', 'prazo', 'situação', 'posição',
      'quando fica pronto', 'quanto tempo', 'atualização de status',
      'follow up', 'acompanhamento', 'progresso',
    ],
    titleBoost: 10,
    weight: 9,
  },
  other: {
    keywords: [],
    titleBoost: 0,
    weight: 0,
  },
};

// ---------------------------------------------------------------------------
// Entity extraction helpers
// ---------------------------------------------------------------------------

function extractEntities(text: string, intentType: IntentType): Record<string, string> {
  const entities: Record<string, string> = {};
  const lower = text.toLowerCase();

  // Extract email
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) {
    entities.email = emailMatch[0];
  }

  // Extract system/application names (common patterns)
  const systemPatterns = [
    /(?:sistema|system|aplicativo|app|software|programa)\s+([A-Za-zÀ-ÿ0-9]+)/i,
    /(?:no|do|da|para o|para a)\s+(SAP|ERP|CRM|Teams|Outlook|Office|Windows|Linux|VPN|Jira|Confluence|Slack)/i,
  ];
  for (const pattern of systemPatterns) {
    const match = text.match(pattern);
    if (match) {
      entities.system = match[1];
      break;
    }
  }

  // Extract username
  const userPatterns = [
    /(?:usuário|user|login|matrícula|username)\s*[:\-]?\s*([A-Za-z0-9._]+)/i,
  ];
  for (const pattern of userPatterns) {
    const match = text.match(pattern);
    if (match) {
      entities.username = match[1];
      break;
    }
  }

  // For software_install, try to detect the software name
  if (intentType === 'software_install') {
    const softwareMatch = text.match(
      /(?:instalar|instalação|install|atualizar|update)\s+(?:o\s+|a\s+|do\s+|da\s+)?([A-Za-zÀ-ÿ0-9. ]+?)(?:\s*[.,;]|\s+(?:no|na|em|para|por favor)|\s*$)/i
    );
    if (softwareMatch) {
      entities.software = softwareMatch[1].trim();
    }
  }

  return entities;
}

// ---------------------------------------------------------------------------
// IntentResolver
// ---------------------------------------------------------------------------

export class IntentResolver {
  /**
   * Resolve the intent from a ticket's title and description.
   */
  async resolveIntent(title: string, description: string): Promise<Intent> {
    const scores: Record<IntentType, number> = {} as Record<IntentType, number>;

    const titleLower = (title || '').toLowerCase();
    const descLower = (description || '').toLowerCase();
    const fullText = `${titleLower} ${descLower}`;

    // Score each intent type
    for (const intentType of INTENT_TYPES) {
      if (intentType === 'other') {
        scores[intentType] = 0;
        continue;
      }

      const rule = INTENT_KEYWORDS[intentType];
      let score = 0;

      for (const keyword of rule.keywords) {
        const keyLower = keyword.toLowerCase();

        // Check title (higher weight)
        if (titleLower.includes(keyLower)) {
          score += rule.weight + rule.titleBoost;
        }
        // Check description
        if (descLower.includes(keyLower)) {
          score += rule.weight;
        }
      }

      scores[intentType] = score;
    }

    // Find highest scoring intent
    let bestIntent: IntentType = 'other';
    let bestScore = 0;

    for (const [intent, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent as IntentType;
      }
    }

    // Normalize confidence to 0–100
    // A perfect match would hit ~3-4 keywords in title+description ≈ 80-120 raw score
    const maxExpected = 100;
    const confidence = bestIntent === 'other'
      ? 10
      : Math.min(100, Math.round((bestScore / maxExpected) * 100));

    const entities = extractEntities(fullText, bestIntent);

    logger.info(`Intent resolved: ${bestIntent} (confidence: ${confidence})`, {
      type: 'ai_agent',
      intent: bestIntent,
      confidence,
      rawScore: bestScore,
    });

    return {
      type: bestIntent,
      confidence,
      entities,
    };
  }
}

export const intentResolver = new IntentResolver();
