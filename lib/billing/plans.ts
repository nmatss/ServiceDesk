/**
 * Insighta Plan Definitions — Single Source of Truth
 *
 * All plan tiers, features, and limits are defined here.
 * Landing page, admin billing, backend guards, and Stripe integration
 * all import from this file.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PlanTier = 'starter' | 'essencial' | 'professional' | 'enterprise';

/** Feature level types — ordered from least to most permissive */
export type AILevel = 'none' | 'basic' | 'copilot' | 'full';
export type ITILLevel = 'none' | 'incident' | 'standard' | 'full';
export type WorkflowLevel = 'none' | 'builder' | 'full';
export type KBLevel = 'read' | 'readwrite' | 'ai' | 'full';
export type IntegrationLevel = 'email' | 'whatsapp' | 'api' | 'full';
export type AnalyticsLevel = 'basic' | 'standard' | 'custom' | 'predictive';
export type SecurityLevel = 'basic' | 'rbac' | 'audit' | 'enterprise';

export interface PlanFeatures {
  // Quantitative limits
  maxAgents: number;            // -1 = unlimited
  ticketsPerMonth: number;      // -1 = unlimited
  maxAutomationRules: number;   // -1 = unlimited, 0 = none
  maxSlaPolicies: number;       // -1 = unlimited

  // Feature levels per module
  ai: AILevel;
  itil: ITILLevel;
  workflows: WorkflowLevel;
  knowledgeBase: KBLevel;
  integrations: IntegrationLevel;
  analytics: AnalyticsLevel;
  security: SecurityLevel;
}

export interface PlanDisplayInfo {
  name: string;
  description: string;
  priceMonthly: number | null;  // null = "Sob Consulta"
  priceYearly: number | null;   // null = "Sob Consulta"
  features: PlanFeatures;
  popular: boolean;
}

// ─── Feature Level Ordering (for comparisons) ───────────────────────────────

const LEVEL_ORDER: Record<string, string[]> = {
  ai:           ['none', 'basic', 'copilot', 'full'],
  itil:         ['none', 'incident', 'standard', 'full'],
  workflows:    ['none', 'builder', 'full'],
  knowledgeBase: ['read', 'readwrite', 'ai', 'full'],
  integrations: ['email', 'whatsapp', 'api', 'full'],
  analytics:    ['basic', 'standard', 'custom', 'predictive'],
  security:     ['basic', 'rbac', 'audit', 'enterprise'],
};

/**
 * Check if a plan's feature level meets the minimum required level.
 * @returns true if `actual` >= `required` in the ordering for that feature
 */
export function meetsFeatureLevel(
  feature: keyof PlanFeatures,
  actual: string,
  required: string
): boolean {
  const order = LEVEL_ORDER[feature];
  if (!order) return true; // quantitative limits are checked separately
  const actualIdx = order.indexOf(actual);
  const requiredIdx = order.indexOf(required);
  if (actualIdx === -1 || requiredIdx === -1) return false;
  return actualIdx >= requiredIdx;
}

// ─── Plan Definitions ────────────────────────────────────────────────────────

export const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  starter: {
    maxAgents: 3,
    ticketsPerMonth: 100,
    maxAutomationRules: 0,
    maxSlaPolicies: 1,
    ai: 'none',
    itil: 'none',
    workflows: 'none',
    knowledgeBase: 'read',
    integrations: 'email',
    analytics: 'basic',
    security: 'basic',
  },
  essencial: {
    maxAgents: 10,
    ticketsPerMonth: -1,
    maxAutomationRules: 10,
    maxSlaPolicies: 5,
    ai: 'basic',
    itil: 'incident',
    workflows: 'none',
    knowledgeBase: 'readwrite',
    integrations: 'whatsapp',
    analytics: 'standard',
    security: 'rbac',
  },
  professional: {
    maxAgents: 50,
    ticketsPerMonth: -1,
    maxAutomationRules: -1,
    maxSlaPolicies: -1,
    ai: 'copilot',
    itil: 'standard',
    workflows: 'builder',
    knowledgeBase: 'ai',
    integrations: 'api',
    analytics: 'custom',
    security: 'audit',
  },
  enterprise: {
    maxAgents: -1,
    ticketsPerMonth: -1,
    maxAutomationRules: -1,
    maxSlaPolicies: -1,
    ai: 'full',
    itil: 'full',
    workflows: 'full',
    knowledgeBase: 'full',
    integrations: 'full',
    analytics: 'predictive',
    security: 'enterprise',
  },
};

// ─── Display Info (for landing page and admin billing) ──────────────────────

export const PLAN_DISPLAY: Record<PlanTier, PlanDisplayInfo> = {
  starter: {
    name: 'Starter',
    description: 'Equipes pequenas ou primeiro Help Desk',
    priceMonthly: 0,
    priceYearly: 0,
    features: PLAN_FEATURES.starter,
    popular: false,
  },
  essencial: {
    name: 'Essencial',
    description: 'Times de suporte em crescimento',
    priceMonthly: 89,
    priceYearly: 74,
    features: PLAN_FEATURES.essencial,
    popular: false,
  },
  professional: {
    name: 'Profissional',
    description: 'Service Desk corporativo completo',
    priceMonthly: 149,
    priceYearly: 124,
    features: PLAN_FEATURES.professional,
    popular: true,
  },
  enterprise: {
    name: 'Enterprise',
    description: 'BPO, MSP ou grandes corporacoes',
    priceMonthly: null,
    priceYearly: null,
    features: PLAN_FEATURES.enterprise,
    popular: false,
  },
};

// ─── Plan Tier Ordering ─────────────────────────────────────────────────────

export const PLAN_TIER_ORDER: PlanTier[] = ['starter', 'essencial', 'professional', 'enterprise'];

/**
 * Check if a plan tier meets a minimum tier requirement.
 */
export function meetsPlanTier(actual: PlanTier, required: PlanTier): boolean {
  return PLAN_TIER_ORDER.indexOf(actual) >= PLAN_TIER_ORDER.indexOf(required);
}

/**
 * Resolve a plan name to a valid PlanTier (handles legacy aliases).
 */
export function resolvePlanTier(plan: string): PlanTier {
  if (plan === 'basic') return 'starter';
  if (PLAN_TIER_ORDER.includes(plan as PlanTier)) return plan as PlanTier;
  return 'starter'; // fallback
}

// ─── Backwards Compatibility (for subscription-manager.ts) ──────────────────

/**
 * Legacy PlanLimits format — used by existing checkLimit() and getSubscriptionStatus()
 */
export interface LegacyPlanLimits {
  users: number;
  tickets_month: number;
  ai: boolean;
  esm: boolean;
}

/**
 * Convert PlanFeatures to legacy PlanLimits format.
 */
export function toLegacyLimits(features: PlanFeatures): LegacyPlanLimits {
  return {
    users: features.maxAgents,
    tickets_month: features.ticketsPerMonth,
    ai: features.ai !== 'none',
    esm: features.itil !== 'none',
  };
}

/**
 * Get legacy PlanLimits for a plan name (handles aliases).
 */
export function getLegacyLimits(plan: string): LegacyPlanLimits {
  const tier = resolvePlanTier(plan);
  return toLegacyLimits(PLAN_FEATURES[tier]);
}

// ─── Feature Display Labels (for UI) ───────────────────────────────────────

export const PLAN_FEATURE_LISTS: Record<PlanTier, string[]> = {
  starter: [
    'Ate 3 agentes',
    '100 tickets/mes',
    'Portal do cliente',
    'E-mail e formulario web',
    'SLA basico',
    'Base de conhecimento (leitura)',
    'Dashboard basico',
  ],
  essencial: [
    'Ate 10 agentes',
    'Tickets ilimitados',
    'WhatsApp + E-mail + Portal',
    'SLA avancado com alertas',
    'Automacoes (ate 10 regras)',
    'IA para classificacao',
    'Gestao de Incidentes ITIL',
    'Relatorios personalizados',
    'Suporte por chat',
  ],
  professional: [
    'Ate 50 agentes',
    'Tudo do Essencial +',
    'IA Copilot + Sentimento',
    'Gestao de Problemas e Mudancas',
    'Workflow Builder',
    'Automacoes ilimitadas',
    'API RESTful completa',
    'Integracoes Webhooks',
    'Audit log completo',
    'Suporte prioritario 24/7',
  ],
  enterprise: [
    'Agentes ilimitados',
    'Tudo do Profissional +',
    'IA Auto-resolve',
    'CMDB e Catalogo de Servicos',
    'CAB (Change Advisory Board)',
    'Multi-tenant (multi-empresa)',
    'SSO/SAML/LDAP',
    'Audit trail 7 anos (COBIT)',
    'Integracoes ERP/CRM',
    'Gerente de sucesso dedicado',
  ],
};
