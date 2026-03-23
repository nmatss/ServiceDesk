'use client';

/**
 * usePlan Hook — Frontend subscription/plan awareness
 *
 * Fetches and caches the tenant's plan from /api/billing/status.
 * Used by Sidebar, pages, and components to conditionally show features.
 *
 * @example
 * const { tier, features, loading } = usePlan();
 * if (!loading && features.ai === 'none') { showUpgrade() }
 */

import { useState, useEffect } from 'react';
import {
  PLAN_FEATURES,
  meetsFeatureLevel,
  resolvePlanTier,
  type PlanTier,
  type PlanFeatures,
} from '@/lib/billing/plans';

// ─── Cache ──────────────────────────────────────────────────────────────────

interface CachedPlanData {
  tier: PlanTier;
  features: PlanFeatures;
  status: string;
  timestamp: number;
}

let _cachedPlan: CachedPlanData | null = null;
const PLAN_CACHE_TTL = 60_000; // 60 seconds

function getCachedPlan(): CachedPlanData | null {
  if (_cachedPlan && Date.now() - _cachedPlan.timestamp < PLAN_CACHE_TTL) {
    return _cachedPlan;
  }
  return null;
}

function setCachedPlan(data: CachedPlanData) {
  _cachedPlan = data;
}

/** Clear plan cache (call after subscription change) */
export function clearPlanCache() {
  _cachedPlan = null;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UsePlanResult {
  tier: PlanTier;
  features: PlanFeatures;
  status: string;
  loading: boolean;
  error: string | null;
  /** Check if current plan meets a feature level */
  hasFeature: (feature: keyof PlanFeatures, requiredLevel: string) => boolean;
  /** Check if current plan meets a minimum tier */
  hasTier: (minTier: PlanTier) => boolean;
}

const TIER_ORDER: PlanTier[] = ['starter', 'essencial', 'professional', 'enterprise'];

export function usePlan(): UsePlanResult {
  const [tier, setTier] = useState<PlanTier>('starter');
  const [features, setFeatures] = useState<PlanFeatures>(PLAN_FEATURES.starter);
  const [status, setStatus] = useState<string>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      // Check cache first
      const cached = getCachedPlan();
      if (cached) {
        setTier(cached.tier);
        setFeatures(cached.features);
        setStatus(cached.status);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/billing/status', { credentials: 'include' });
        if (!res.ok) {
          // Not authenticated or no billing — default to starter
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (data.success && data.data) {
          const resolvedTier = resolvePlanTier(data.data.plan || 'starter');
          const resolvedFeatures = PLAN_FEATURES[resolvedTier];

          setTier(resolvedTier);
          setFeatures(resolvedFeatures);
          setStatus(data.data.status || 'active');

          setCachedPlan({
            tier: resolvedTier,
            features: resolvedFeatures,
            status: data.data.status || 'active',
            timestamp: Date.now(),
          });
        }
      } catch {
        setError('Failed to fetch plan');
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, []);

  const hasFeature = (feature: keyof PlanFeatures, requiredLevel: string): boolean => {
    const actual = features[feature];
    if (typeof actual === 'number') return actual === -1 || actual > 0;
    return meetsFeatureLevel(feature, actual as string, requiredLevel);
  };

  const hasTier = (minTier: PlanTier): boolean => {
    return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minTier);
  };

  return { tier, features, status, loading, error, hasFeature, hasTier };
}

export default usePlan;
