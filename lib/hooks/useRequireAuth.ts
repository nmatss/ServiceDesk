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

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// User interface matching database schema
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user' | 'manager' | 'read_only';
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

    const verifyAuth = async () => {
      try {
        setLoading(true);
        setError(null);

        // SECURITY: Auth via httpOnly cookies only
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include' // Include httpOnly cookies
        });

        if (!isMounted) return;

        // Not authenticated - redirect to login
        if (!response.ok) {
          setUser(null);
          setTenant(null);
          setLoading(false);
          router.push(redirectTo);
          return;
        }

        const data = await response.json();

        // Invalid response - redirect to login
        if (!data.success || !data.user) {
          setUser(null);
          setTenant(null);
          setLoading(false);
          router.push(redirectTo);
          return;
        }

        const authenticatedUser = data.user as User;
        const userTenant = data.tenant as Tenant | null;

        // Check tenant requirement
        if (requireTenant && !userTenant) {
          setUser(authenticatedUser);
          setTenant(null);
          setLoading(false);
          router.push('/tenant-not-found');
          return;
        }

        // Check role requirement
        if (requiredRole) {
          const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
          const hasRequiredRole = allowedRoles.includes(authenticatedUser.role);

          if (!hasRequiredRole) {
            // Check if user is admin (admin bypasses most role checks)
            if (authenticatedUser.role !== 'admin') {
              setUser(authenticatedUser);
              setTenant(userTenant);
              setLoading(false);
              router.push(unauthorizedRedirect);
              return;
            }
          }
        }

        // All checks passed
        setUser(authenticatedUser);
        setTenant(userTenant);
        setLoading(false);

      } catch (err) {
        if (!isMounted) return;

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
