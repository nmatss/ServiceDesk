'use client';

/**
 * useRequireAuth Hook - Centralized Authentication and Authorization
 *
 * This hook eliminates 900+ lines of duplicate auth checking code across pages.
 * It handles authentication verification, role checking, redirects, and loading states.
 *
 * @example
 * // Require any authenticated user
 * const { user, loading, error } = useRequireAuth();
 *
 * @example
 * // Require admin role
 * const { user, loading } = useRequireAuth({ requiredRole: 'admin' });
 *
 * @example
 * // Require agent or admin role
 * const { user, loading } = useRequireAuth({ requiredRole: ['agent', 'admin'] });
 *
 * @example
 * // Custom redirect and tenant requirement
 * const { user } = useRequireAuth({
 *   redirectTo: '/custom-login',
 *   requireTenant: true
 * });
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Global auth cache — shared across all useRequireAuth instances.
// Eliminates redundant /api/auth/verify calls when AppLayout already verified.
let _cachedAuthData: { user: User; tenant: Tenant | null; timestamp: number } | null = null;
const AUTH_CACHE_TTL = 30_000; // 30 seconds — matches AppLayout cooldown

function getCachedAuth() {
  if (_cachedAuthData && Date.now() - _cachedAuthData.timestamp < AUTH_CACHE_TTL) {
    return _cachedAuthData;
  }
  return null;
}

function setCachedAuth(user: User, tenant: Tenant | null) {
  _cachedAuthData = { user, tenant, timestamp: Date.now() };
}

function clearCachedAuth() {
  _cachedAuthData = null;
}

/** Allow AppLayout to populate the cache after its own /api/auth/verify call */
export function populateAuthCache(user: User, tenant: Tenant | null) {
  setCachedAuth(user, tenant);
}

// User interface matching database schema
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'tenant_admin' | 'team_manager' | 'agent' | 'user';
  tenant_id: number;
  job_title?: string;
  department?: string;
  avatar_url?: string;
}

export interface Tenant {
  id: number;
  slug: string;
  name: string;
}

export interface UseRequireAuthOptions {
  /**
   * Required role(s) for accessing the page.
   * Can be a single role or array of allowed roles.
   * If user doesn't have required role, they'll be redirected.
   */
  requiredRole?: string | string[];

  /**
   * Where to redirect if not authenticated.
   * @default '/auth/login'
   */
  redirectTo?: string;

  /**
   * Whether to require tenant context.
   * If true, redirects if user has no tenant.
   * @default false
   */
  requireTenant?: boolean;

  /**
   * Where to redirect if user lacks required role.
   * @default '/unauthorized'
   */
  unauthorizedRedirect?: string;
}

export interface UseRequireAuthResult {
  /** Current authenticated user or null if not authenticated */
  user: User | null;

  /** Current user's tenant or null */
  tenant: Tenant | null;

  /** Whether auth check is in progress */
  loading: boolean;

  /** Error if auth check failed */
  error: Error | null;

  /** Whether user is authenticated */
  isAuthenticated: boolean;
}

/**
 * Hook to require authentication and optional role/tenant checks.
 * Automatically redirects users who don't meet requirements.
 *
 * SECURITY: Uses httpOnly cookies via /api/auth/verify endpoint.
 * Never stores tokens in localStorage or client state.
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}): UseRequireAuthResult {
  const {
    requiredRole,
    redirectTo = '/auth/login',
    requireTenant = false,
    unauthorizedRedirect = '/unauthorized'
  } = options;

  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const applyAuthChecks = (authenticatedUser: User, userTenant: Tenant | null): boolean => {
      // Check tenant requirement
      if (requireTenant && !userTenant) {
        setUser(authenticatedUser);
        setTenant(null);
        setLoading(false);
        router.push('/tenant-not-found');
        return false;
      }

      // Check role requirement
      if (requiredRole) {
        const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
        const hasRequiredRole = allowedRoles.includes(authenticatedUser.role);

        if (!hasRequiredRole && authenticatedUser.role !== 'admin') {
          setUser(authenticatedUser);
          setTenant(userTenant);
          setLoading(false);
          router.push(unauthorizedRedirect);
          return false;
        }
      }

      // All checks passed
      setUser(authenticatedUser);
      setTenant(userTenant);
      setLoading(false);
      return true;
    };

    const verifyAuth = async () => {
      try {
        setError(null);

        // PERF: Check global cache first — avoids redundant /api/auth/verify calls
        // when AppLayout (or another useRequireAuth instance) already verified recently.
        const cached = getCachedAuth();
        if (cached) {
          if (!isMounted) return;
          applyAuthChecks(cached.user, cached.tenant);
          return;
        }

        // No cache hit — make the API call
        setLoading(true);

        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include'
        });

        if (!isMounted) return;

        if (!response.ok) {
          clearCachedAuth();
          setUser(null);
          setTenant(null);
          setLoading(false);
          router.push(redirectTo);
          return;
        }

        const data = await response.json();

        if (!data.success || !data.user) {
          clearCachedAuth();
          setUser(null);
          setTenant(null);
          setLoading(false);
          router.push(redirectTo);
          return;
        }

        const authenticatedUser = data.user as User;
        const userTenant = data.tenant as Tenant | null;

        // Cache the successful auth result globally
        setCachedAuth(authenticatedUser, userTenant);

        applyAuthChecks(authenticatedUser, userTenant);

      } catch (err) {
        if (!isMounted) return;

        clearCachedAuth();
        console.error('Auth verification failed:', err);
        setError(err instanceof Error ? err : new Error('Authentication failed'));
        setUser(null);
        setTenant(null);
        setLoading(false);
        router.push(redirectTo);
      }
    };

    verifyAuth();

    return () => {
      isMounted = false;
    };
  }, [requiredRole, redirectTo, requireTenant, unauthorizedRedirect, router]);

  return {
    user,
    tenant,
    loading,
    error,
    isAuthenticated: user !== null
  };
}

/**
 * Hook variant for pages that require admin role.
 * Shorthand for useRequireAuth({ requiredRole: 'admin' })
 */
export function useRequireAdmin() {
  return useRequireAuth({ requiredRole: 'admin' });
}

/**
 * Hook variant for pages that require agent or admin role.
 * Shorthand for useRequireAuth({ requiredRole: ['agent', 'admin'] })
 */
export function useRequireAgent() {
  return useRequireAuth({ requiredRole: ['agent', 'admin'] });
}

/**
 * Hook variant for pages that require manager or admin role.
 * Shorthand for useRequireAuth({ requiredRole: ['manager', 'admin'] })
 */
export function useRequireManager() {
  return useRequireAuth({ requiredRole: ['manager', 'admin'] });
}

export default useRequireAuth;
