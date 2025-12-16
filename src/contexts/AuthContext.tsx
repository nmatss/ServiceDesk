'use client';

/**
 * AuthContext - Centralized Authentication State Management
 *
 * This context provides a single source of truth for authentication state,
 * eliminating prop drilling and ensuring consistent auth state across components.
 *
 * SECURITY: Auth tokens are stored in httpOnly cookies (set by server)
 * and accessed via API calls, not directly in this context.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode
} from 'react';
import { useRouter } from 'next/navigation';

// Types
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

export interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  login: (email: string, password: string, tenantSlug?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  clearError: () => void;
  hasPermission: (permission: string) => boolean;
  isAdmin: boolean;
  isAgent: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Permission mappings for role-based access control
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'], // All permissions
  manager: [
    'tickets:read', 'tickets:write', 'tickets:delete',
    'users:read', 'users:write',
    'reports:read', 'reports:export',
    'settings:read', 'settings:write'
  ],
  agent: [
    'tickets:read', 'tickets:write',
    'kb:read', 'kb:write',
    'reports:read'
  ],
  user: [
    'tickets:read', 'tickets:create',
    'kb:read'
  ],
  read_only: [
    'tickets:read',
    'kb:read',
    'reports:read'
  ]
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    tenant: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  // Verify auth status on mount
  const refreshAuth = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/auth/verify', {
        credentials: 'include' // Include cookies
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setState({
            user: data.user,
            tenant: data.tenant || null,
            isAuthenticated: true,
            isLoading: false,
            error: null
          });
          return;
        }
      }

      // Not authenticated
      setState({
        user: null,
        tenant: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('Auth verification failed:', error);
      setState({
        user: null,
        tenant: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    }
  }, []);

  // Initial auth check
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  // Login function
  const login = useCallback(async (
    email: string,
    password: string,
    tenantSlug?: string
  ): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, tenant_slug: tenantSlug })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setState({
          user: data.user,
          tenant: data.tenant || null,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
        return true;
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: data.error || 'Falha na autenticação'
      }));
      return false;
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Erro de conexão. Tente novamente.'
      }));
      return false;
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setState({
        user: null,
        tenant: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
      router.push('/auth/login');
    }
  }, [router]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Permission check
  const hasPermission = useCallback((permission: string): boolean => {
    if (!state.user) return false;

    const userPermissions = ROLE_PERMISSIONS[state.user.role] || [];

    // Admin has all permissions
    if (userPermissions.includes('*')) return true;

    // Check specific permission
    return userPermissions.includes(permission);
  }, [state.user]);

  // Memoized role checks
  const isAdmin = useMemo(() => state.user?.role === 'admin', [state.user]);
  const isAgent = useMemo(() =>
    state.user?.role === 'agent' || state.user?.role === 'admin',
    [state.user]
  );
  const isManager = useMemo(() =>
    state.user?.role === 'manager' || state.user?.role === 'admin',
    [state.user]
  );

  // Memoized context value
  const contextValue = useMemo<AuthContextValue>(() => ({
    ...state,
    login,
    logout,
    refreshAuth,
    clearError,
    hasPermission,
    isAdmin,
    isAgent,
    isManager
  }), [state, login, logout, refreshAuth, clearError, hasPermission, isAdmin, isAgent, isManager]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for using auth context
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protected routes
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: { redirectTo?: string; requiredRole?: string }
) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push(options?.redirectTo || '/auth/login');
      }

      if (!isLoading && isAuthenticated && options?.requiredRole) {
        if (user?.role !== options.requiredRole && user?.role !== 'admin') {
          router.push('/403');
        }
      }
    }, [isLoading, isAuthenticated, user, router]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };
}

export default AuthContext;
