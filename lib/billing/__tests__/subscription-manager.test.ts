import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db/adapter', () => ({
  executeQueryOne: vi.fn(),
  executeRun: vi.fn(() => ({ changes: 1 })),
  sqlStartOfMonth: vi.fn(() => "date('now', 'start of month')"),
}));

vi.mock('@/lib/monitoring/structured-logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { executeQueryOne, executeRun } from '@/lib/db/adapter';
import {
  PLAN_LIMITS,
  getSubscriptionStatus,
  checkLimit,
  updateSubscription,
  cancelSubscription,
  handlePaymentFailed,
} from '../subscription-manager';

const mockExecuteQueryOne = executeQueryOne as ReturnType<typeof vi.fn>;
const mockExecuteRun = executeRun as ReturnType<typeof vi.fn>;

describe('subscription-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. PLAN_LIMITS constants ──────────────────────────────────────────

  describe('PLAN_LIMITS', () => {
    it('basic plan has correct limits', () => {
      expect(PLAN_LIMITS.basic).toEqual({
        users: 3,
        tickets_month: 100,
        ai: false,
        esm: false,
      });
    });

    it('starter plan has correct limits', () => {
      expect(PLAN_LIMITS.starter).toEqual({
        users: 3,
        tickets_month: 100,
        ai: false,
        esm: false,
      });
    });

    it('professional plan has correct limits', () => {
      expect(PLAN_LIMITS.professional).toEqual({
        users: 15,
        tickets_month: 1000,
        ai: true,
        esm: true,
      });
    });

    it('enterprise plan has unlimited users and tickets', () => {
      expect(PLAN_LIMITS.enterprise).toEqual({
        users: -1,
        tickets_month: -1,
        ai: true,
        esm: true,
      });
    });
  });

  // ── 2–3. getSubscriptionStatus ────────────────────────────────────────

  describe('getSubscriptionStatus', () => {
    it('returns correct data with mocked queries', async () => {
      mockExecuteQueryOne
        .mockResolvedValueOnce({
          subscription_plan: 'professional',
          subscription_status: 'active',
          subscription_expires_at: '2026-12-31',
          stripe_customer_id: 'cus_123',
          stripe_subscription_id: 'sub_456',
        })
        .mockResolvedValueOnce({ count: 10 })
        .mockResolvedValueOnce({ count: 250 });

      const result = await getSubscriptionStatus(1);

      expect(result).toEqual({
        plan: 'professional',
        status: 'active',
        expires_at: '2026-12-31',
        stripe_customer_id: 'cus_123',
        stripe_subscription_id: 'sub_456',
        limits: PLAN_LIMITS.professional,
        usage: {
          users: 10,
          tickets_this_month: 250,
        },
      });

      expect(mockExecuteQueryOne).toHaveBeenCalledTimes(3);
      expect(mockExecuteQueryOne).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT subscription_plan'),
        [1],
      );
      expect(mockExecuteQueryOne).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('FROM users'),
        [1],
      );
      expect(mockExecuteQueryOne).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('FROM tickets'),
        [1],
      );
    });

    it('defaults to basic plan when org not found', async () => {
      mockExecuteQueryOne
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);

      const result = await getSubscriptionStatus(999);

      expect(result.plan).toBe('basic');
      expect(result.status).toBe('active');
      expect(result.expires_at).toBeNull();
      expect(result.stripe_customer_id).toBeNull();
      expect(result.stripe_subscription_id).toBeNull();
      expect(result.limits).toEqual(PLAN_LIMITS.basic);
      expect(result.usage.users).toBe(0);
      expect(result.usage.tickets_this_month).toBe(0);
    });
  });

  // ── 4–7. checkLimit ───────────────────────────────────────────────────

  describe('checkLimit', () => {
    it('allows when under user limit', async () => {
      mockExecuteQueryOne
        .mockResolvedValueOnce({
          subscription_plan: 'starter',
          subscription_status: 'active',
          subscription_expires_at: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
        })
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 50 });

      const result = await checkLimit(1, 'users');

      expect(result).toEqual({ allowed: true });
    });

    it('blocks when at user limit', async () => {
      mockExecuteQueryOne
        .mockResolvedValueOnce({
          subscription_plan: 'starter',
          subscription_status: 'active',
          subscription_expires_at: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
        })
        .mockResolvedValueOnce({ count: 3 })
        .mockResolvedValueOnce({ count: 50 });

      const result = await checkLimit(1, 'users');

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('3');
      expect(result.message).toContain('starter');
    });

    it('blocks when at ticket limit', async () => {
      mockExecuteQueryOne
        .mockResolvedValueOnce({
          subscription_plan: 'basic',
          subscription_status: 'active',
          subscription_expires_at: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
        })
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 100 });

      const result = await checkLimit(1, 'tickets');

      expect(result.allowed).toBe(false);
      expect(result.message).toContain('100');
      expect(result.message).toContain('basic');
    });

    it('allows unlimited for enterprise plan (users)', async () => {
      mockExecuteQueryOne
        .mockResolvedValueOnce({
          subscription_plan: 'enterprise',
          subscription_status: 'active',
          subscription_expires_at: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
        })
        .mockResolvedValueOnce({ count: 9999 })
        .mockResolvedValueOnce({ count: 50000 });

      const result = await checkLimit(1, 'users');

      expect(result).toEqual({ allowed: true });
    });

    it('allows unlimited for enterprise plan (tickets)', async () => {
      mockExecuteQueryOne
        .mockResolvedValueOnce({
          subscription_plan: 'enterprise',
          subscription_status: 'active',
          subscription_expires_at: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
        })
        .mockResolvedValueOnce({ count: 9999 })
        .mockResolvedValueOnce({ count: 50000 });

      const result = await checkLimit(1, 'tickets');

      expect(result).toEqual({ allowed: true });
    });
  });

  // ── 8. updateSubscription ─────────────────────────────────────────────

  describe('updateSubscription', () => {
    it('builds correct SQL with only required params', async () => {
      await updateSubscription(1, 'professional');

      expect(mockExecuteRun).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecuteRun.mock.calls[0];
      expect(sql).toContain('UPDATE organizations SET');
      expect(sql).toContain('subscription_plan = ?');
      expect(sql).toContain('subscription_status = ?');
      expect(sql).toContain('max_users = ?');
      expect(sql).toContain('max_tickets_per_month = ?');
      expect(sql).toContain('WHERE id = ?');
      // params: plan, 'active', max_users, max_tickets_per_month, orgId
      expect(params).toEqual(['professional', 'active', 15, 1000, 1]);
    });

    it('includes optional stripe customer id', async () => {
      await updateSubscription(1, 'professional', 'cus_abc');

      const [sql, params] = mockExecuteRun.mock.calls[0];
      expect(sql).toContain('stripe_customer_id = ?');
      expect(params).toContain('cus_abc');
    });

    it('includes optional stripe subscription id', async () => {
      await updateSubscription(1, 'professional', undefined, 'sub_xyz');

      const [sql, params] = mockExecuteRun.mock.calls[0];
      expect(sql).toContain('stripe_subscription_id = ?');
      expect(params).toContain('sub_xyz');
    });

    it('includes optional expires_at', async () => {
      await updateSubscription(1, 'enterprise', undefined, undefined, '2027-01-01');

      const [sql, params] = mockExecuteRun.mock.calls[0];
      expect(sql).toContain('subscription_expires_at = ?');
      expect(params).toContain('2027-01-01');
    });

    it('includes all optional params when provided', async () => {
      await updateSubscription(1, 'enterprise', 'cus_abc', 'sub_xyz', '2027-01-01');

      const [, params] = mockExecuteRun.mock.calls[0];
      // plan, 'active', stripeCustomerId, stripeSubscriptionId, expiresAt, max_users, max_tickets_per_month, orgId
      expect(params).toEqual([
        'enterprise', 'active',
        'cus_abc', 'sub_xyz', '2027-01-01',
        -1, -1,
        1,
      ]);
    });
  });

  // ── 9. cancelSubscription ─────────────────────────────────────────────

  describe('cancelSubscription', () => {
    it('sets subscription status to cancelled', async () => {
      await cancelSubscription(42);

      expect(mockExecuteRun).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecuteRun.mock.calls[0];
      expect(sql).toContain("subscription_status = 'cancelled'");
      expect(params).toEqual([42]);
    });
  });

  // ── 10. handlePaymentFailed ───────────────────────────────────────────

  describe('handlePaymentFailed', () => {
    it('sets subscription status to past_due', async () => {
      await handlePaymentFailed(7);

      expect(mockExecuteRun).toHaveBeenCalledTimes(1);
      const [sql, params] = mockExecuteRun.mock.calls[0];
      expect(sql).toContain("subscription_status = 'past_due'");
      expect(params).toEqual([7]);
    });
  });
});
