import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { requireTenantUserContext } from '@/lib/tenant/request-guard';
import * as tenantContext from '@/lib/tenant/context';

vi.mock('@/lib/tenant/context', () => ({
  getTenantContextFromRequest: vi.fn(),
  getUserContextFromRequest: vi.fn(),
}));

describe('requireTenantUserContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns context when user and tenant are valid and matching', async () => {
    vi.mocked(tenantContext.getUserContextFromRequest).mockReturnValue({
      id: 10,
      tenant_id: 5,
      role: 'agent',
    });
    vi.mocked(tenantContext.getTenantContextFromRequest).mockReturnValue({
      id: 5,
      slug: 'acme',
      name: 'ACME',
    });

    const request = new NextRequest('http://localhost/api/tickets');
    const result = requireTenantUserContext(request);

    expect(result.response).toBeUndefined();
    expect(result.context).toBeDefined();
    expect(result.context?.user.id).toBe(10);
    expect(result.context?.tenant.id).toBe(5);
  });

  it('returns 401 when user is missing', async () => {
    vi.mocked(tenantContext.getUserContextFromRequest).mockReturnValue(null);
    vi.mocked(tenantContext.getTenantContextFromRequest).mockReturnValue({
      id: 5,
      slug: 'acme',
      name: 'ACME',
    });

    const request = new NextRequest('http://localhost/api/tickets');
    const result = requireTenantUserContext(request);

    expect(result.context).toBeUndefined();
    expect(result.response?.status).toBe(401);
  });

  it('returns 400 when tenant is missing', async () => {
    vi.mocked(tenantContext.getUserContextFromRequest).mockReturnValue({
      id: 10,
      tenant_id: 5,
      role: 'agent',
    });
    vi.mocked(tenantContext.getTenantContextFromRequest).mockReturnValue(null);

    const request = new NextRequest('http://localhost/api/tickets');
    const result = requireTenantUserContext(request);

    expect(result.context).toBeUndefined();
    expect(result.response?.status).toBe(400);
  });

  it('returns 403 on tenant/user mismatch', async () => {
    vi.mocked(tenantContext.getUserContextFromRequest).mockReturnValue({
      id: 10,
      tenant_id: 7,
      role: 'agent',
    });
    vi.mocked(tenantContext.getTenantContextFromRequest).mockReturnValue({
      id: 5,
      slug: 'acme',
      name: 'ACME',
    });

    const request = new NextRequest('http://localhost/api/tickets');
    const result = requireTenantUserContext(request);

    expect(result.context).toBeUndefined();
    expect(result.response?.status).toBe(403);
  });

  it('returns 403 when role is not allowed', async () => {
    vi.mocked(tenantContext.getUserContextFromRequest).mockReturnValue({
      id: 10,
      tenant_id: 5,
      role: 'user',
    });
    vi.mocked(tenantContext.getTenantContextFromRequest).mockReturnValue({
      id: 5,
      slug: 'acme',
      name: 'ACME',
    });

    const request = new NextRequest('http://localhost/api/teams');
    const result = requireTenantUserContext(request, {
      requireRoles: ['super_admin', 'tenant_admin'],
    });

    expect(result.context).toBeUndefined();
    expect(result.response?.status).toBe(403);
  });
});

