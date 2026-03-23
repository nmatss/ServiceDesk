/**
 * Feature Gate — Subscription-based access control for API routes
 *
 * Usage (2 lines in any route):
 *   const gate = await requireFeature(context.organizationId, 'ai', 'basic');
 *   if (gate) return gate;
 *
 * Returns null if allowed, or a 403 NextResponse if blocked.
 * Same pattern as applyRateLimit() and requireTenantUserContext().
 */

import { NextResponse } from 'next/server';
import { executeQueryOne } from '@/lib/db/adapter';
import {
  PLAN_FEATURES,
  meetsFeatureLevel,
  resolvePlanTier,
  PLAN_DISPLAY,
  type PlanTier,
  type PlanFeatures,
} from './plans';

// ─── In-memory cache with TTL ────────────────────────────────────────────────

interface CachedPlan {
  tier: PlanTier;
  features: PlanFeatures;
  status: string;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const planCache = new Map<number, CachedPlan>();

// Periodic cleanup to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of planCache) {
      if (now - val.fetchedAt > CACHE_TTL_MS * 3) {
        planCache.delete(key);
      }
    }
  }, 300_000); // Every 5 minutes
}

async function getOrgPlan(orgId: number): Promise<CachedPlan> {
  const cached = planCache.get(orgId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  try {
    const org = await executeQueryOne<{ subscription_plan: string; subscription_status: string }>(
      'SELECT subscription_plan, subscription_status FROM organizations WHERE id = ?',
      [orgId]
    );

    const tier = resolvePlanTier(org?.subscription_plan || 'starter');
    const entry: CachedPlan = {
      tier,
      features: PLAN_FEATURES[tier],
      status: org?.subscription_status || 'active',
      fetchedAt: Date.now(),
    };

    planCache.set(orgId, entry);
    return entry;
  } catch {
    // Fail-closed: default to most restrictive plan
    const fallback: CachedPlan = {
      tier: 'starter',
      features: PLAN_FEATURES.starter,
      status: 'active',
      fetchedAt: 0, // Don't cache error state
    };
    return fallback;
  }
}

/**
 * Invalidate the cached plan for an organization.
 * Call this after subscription updates, cancellations, or payment failures.
 */
export function invalidateFeatureCache(orgId: number): void {
  planCache.delete(orgId);
}

// ─── Feature-level names for error messages ──────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  ai: 'Inteligencia Artificial',
  itil: 'Modulos ITIL',
  workflows: 'Workflow Builder',
  knowledgeBase: 'Base de Conhecimento',
  integrations: 'Integracoes',
  analytics: 'Analytics Avancado',
  security: 'Seguranca Avancada',
};

const LEVEL_TO_PLAN: Record<string, Record<string, string>> = {
  ai:           { basic: 'Essencial', copilot: 'Profissional', full: 'Enterprise' },
  itil:         { incident: 'Essencial', standard: 'Profissional', full: 'Enterprise' },
  workflows:    { builder: 'Profissional', full: 'Enterprise' },
  knowledgeBase: { readwrite: 'Essencial', ai: 'Profissional', full: 'Enterprise' },
  integrations: { whatsapp: 'Essencial', api: 'Profissional', full: 'Enterprise' },
  analytics:    { standard: 'Essencial', custom: 'Profissional', predictive: 'Enterprise' },
  security:     { rbac: 'Essencial', audit: 'Profissional', enterprise: 'Enterprise' },
};

// ─── Main gate function ─────────────────────────────────────────────────────

type FeatureKey = keyof Pick<
  PlanFeatures,
  'ai' | 'itil' | 'workflows' | 'knowledgeBase' | 'integrations' | 'analytics' | 'security'
>;

/**
 * Check if an organization's plan has access to a feature at the required level.
 *
 * @param orgId - Organization ID
 * @param feature - Feature module key (e.g., 'ai', 'itil', 'workflows')
 * @param requiredLevel - Minimum level needed (e.g., 'basic', 'copilot', 'full')
 * @returns null if allowed, or a 403 NextResponse if blocked
 */
export async function requireFeature(
  orgId: number,
  feature: FeatureKey,
  requiredLevel: string
): Promise<NextResponse | null> {
  const plan = await getOrgPlan(orgId);

  if (plan.status === 'cancelled') {
    return NextResponse.json(
      {
        success: false,
        error: 'Sua assinatura foi cancelada. Reative seu plano para continuar usando este recurso.',
        code: 'SUBSCRIPTION_CANCELLED',
        upgrade_url: '/admin/billing',
      },
      { status: 403 }
    );
  }

  const actual = plan.features[feature] as string;

  if (meetsFeatureLevel(feature, actual, requiredLevel)) {
    return null; // allowed
  }

  const featureLabel = FEATURE_LABELS[feature] || feature;
  const requiredPlan = LEVEL_TO_PLAN[feature]?.[requiredLevel] || 'superior';
  const currentPlanName = PLAN_DISPLAY[plan.tier]?.name || plan.tier;

  return NextResponse.json(
    {
      success: false,
      error: `O recurso "${featureLabel}" requer o plano ${requiredPlan} ou superior.`,
      code: 'FEATURE_NOT_AVAILABLE',
      current_plan: plan.tier,
      current_plan_name: currentPlanName,
      required_plan: requiredPlan,
      upgrade_url: '/admin/billing',
    },
    { status: 403 }
  );
}

/**
 * Check a quantitative limit (automation rules, SLA policies).
 *
 * @param orgId - Organization ID
 * @param limitKey - Key in PlanFeatures (e.g., 'maxAutomationRules')
 * @param currentCount - Current usage count
 * @returns null if allowed, or a 403 NextResponse if at limit
 */
export async function requireLimit(
  orgId: number,
  limitKey: 'maxAutomationRules' | 'maxSlaPolicies',
  currentCount: number
): Promise<NextResponse | null> {
  const plan = await getOrgPlan(orgId);
  const limit = plan.features[limitKey];

  if (limit === -1) return null; // unlimited
  if (limit === 0) {
    const currentPlanName = PLAN_DISPLAY[plan.tier]?.name || plan.tier;
    return NextResponse.json(
      {
        success: false,
        error: `Este recurso nao esta disponivel no plano ${currentPlanName}. Faca upgrade para acessar.`,
        code: 'FEATURE_NOT_AVAILABLE',
        current_plan: plan.tier,
        upgrade_url: '/admin/billing',
      },
      { status: 403 }
    );
  }
  if (currentCount >= limit) {
    const currentPlanName = PLAN_DISPLAY[plan.tier]?.name || plan.tier;
    return NextResponse.json(
      {
        success: false,
        error: `Limite de ${limit} atingido no plano ${currentPlanName}. Faca upgrade para aumentar o limite.`,
        code: 'PLAN_LIMIT_REACHED',
        current_plan: plan.tier,
        limit,
        usage: currentCount,
        upgrade_url: '/admin/billing',
      },
      { status: 403 }
    );
  }

  return null;
}
