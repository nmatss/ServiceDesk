import db from '../db/connection';
import { rbacEngine, AccessContext } from './rbac-engine';
import { logger } from '../monitoring/logger';

export interface DynamicRule {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  condition: string; // JavaScript expression
  priority: number;
  is_active: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface RuleContext extends AccessContext {
  user: {
    id: number;
    role: string;
    department?: string;
    seniority?: number;
    attributes?: Record<string, any>;
  };
  resource: {
    id?: number;
    type: string;
    attributes?: Record<string, any>;
    owner?: number;
    department?: string;
  };
  environment: {
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    sessionDuration?: number;
  };
}

export interface DynamicPermissionResult {
  granted: boolean;
  reason: string;
  appliedRules: string[];
  score: number; // Confidence score 0-100
}

class DynamicPermissionManager {
  private ruleCache = new Map<string, DynamicRule[]>();
  private cacheExpiry = 5 * 60 * 1000; // 5 minutes
  private lastCacheUpdate = 0;

  /**
   * Evaluate dynamic permissions for a given context
   */
  async evaluatePermissions(context: RuleContext): Promise<DynamicPermissionResult> {
    try {
      // Get applicable rules
      const rules = await this.getApplicableRules(context.resource.type, context.action);

      if (rules.length === 0) {
        // Fall back to static RBAC if no dynamic rules
        const staticResult = await rbacEngine.checkPermission(context);
        return {
          granted: staticResult.granted,
          reason: staticResult.reason || 'Static RBAC evaluation',
          appliedRules: [],
          score: staticResult.granted ? 100 : 0
        };
      }

      // Sort rules by priority (highest first)
      rules.sort((a, b) => b.priority - a.priority);

      const appliedRules: string[] = [];
      let finalDecision = false;
      let decisionReason = 'No applicable rules';
      let totalScore = 0;
      let ruleCount = 0;

      // Evaluate each rule
      for (const rule of rules) {
        try {
          const ruleResult = await this.evaluateRule(rule, context);

          if (ruleResult.applies) {
            appliedRules.push(rule.name);
            ruleCount++;

            // Use the highest priority rule that applies as the final decision
            if (appliedRules.length === 1) {
              finalDecision = ruleResult.granted;
              decisionReason = ruleResult.reason;
            }

            // Calculate cumulative score
            totalScore += ruleResult.granted ? rule.priority : 0;
          }
        } catch (error) {
          logger.error(`Error evaluating rule ${rule.name}:`, error);
          // Continue with other rules
        }
      }

      const averageScore = ruleCount > 0 ? Math.min(100, (totalScore / (ruleCount * 100)) * 100) : 0;

      return {
        granted: finalDecision,
        reason: decisionReason,
        appliedRules,
        score: averageScore
      };
    } catch (error) {
      logger.error('Error evaluating dynamic permissions', error);

      // Fall back to static RBAC on error
      const staticResult = await rbacEngine.checkPermission(context);
      return {
        granted: staticResult.granted,
        reason: 'Fallback to static RBAC due to error',
        appliedRules: [],
        score: staticResult.granted ? 50 : 0
      };
    }
  }

  /**
   * Create a new dynamic rule
   */
  async createRule(rule: Omit<DynamicRule, 'id' | 'created_at' | 'updated_at'>): Promise<string | null> {
    try {
      // Validate the condition syntax
      const isValid = await this.validateCondition(rule.condition);
      if (!isValid) {
        throw new Error('Invalid condition syntax');
      }

      const ruleId = this.generateRuleId();

      db.prepare(`
        INSERT INTO dynamic_permission_rules
        (id, name, description, resource, action, condition, priority, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ruleId,
        rule.name,
        rule.description,
        rule.resource,
        rule.action,
        rule.condition,
        rule.priority,
        rule.is_active ? 1 : 0,
        rule.created_by
      );

      // Clear cache
      this.clearCache();

      return ruleId;
    } catch (error) {
      logger.error('Error creating dynamic rule', error);
      return null;
    }
  }

  /**
   * Update an existing dynamic rule
   */
  async updateRule(ruleId: string, updates: Partial<DynamicRule>): Promise<boolean> {
    try {
      // Validate condition if provided
      if (updates.condition) {
        const isValid = await this.validateCondition(updates.condition);
        if (!isValid) {
          throw new Error('Invalid condition syntax');
        }
      }

      const fields = [];
      const values = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }

      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }

      if (updates.condition !== undefined) {
        fields.push('condition = ?');
        values.push(updates.condition);
      }

      if (updates.priority !== undefined) {
        fields.push('priority = ?');
        values.push(updates.priority);
      }

      if (updates.is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(updates.is_active ? 1 : 0);
      }

      if (fields.length === 0) return false;

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(ruleId);

      const stmt = db.prepare(`
        UPDATE dynamic_permission_rules
        SET ${fields.join(', ')}
        WHERE id = ?
      `);

      const result = stmt.run(...values);

      if (result.changes > 0) {
        this.clearCache();
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error updating dynamic rule', error);
      return false;
    }
  }

  /**
   * Delete a dynamic rule
   */
  deleteRule(ruleId: string): boolean {
    try {
      const stmt = db.prepare(`
        DELETE FROM dynamic_permission_rules WHERE id = ?
      `);

      const result = stmt.run(ruleId);

      if (result.changes > 0) {
        this.clearCache();
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error deleting dynamic rule', error);
      return false;
    }
  }

  /**
   * Get all dynamic rules
   */
  getAllRules(): DynamicRule[] {
    try {
      return db.prepare(`
        SELECT * FROM dynamic_permission_rules
        ORDER BY priority DESC, created_at DESC
      `).all() as DynamicRule[];
    } catch (error) {
      logger.error('Error getting all dynamic rules', error);
      return [];
    }
  }

  /**
   * Get applicable rules for resource and action
   */
  private async getApplicableRules(resource: string, action: string): Promise<DynamicRule[]> {
    const cacheKey = `${resource}:${action}`;

    // Check cache
    if (this.isCacheValid() && this.ruleCache.has(cacheKey)) {
      return this.ruleCache.get(cacheKey)!;
    }

    try {
      const rules = db.prepare(`
        SELECT * FROM dynamic_permission_rules
        WHERE is_active = 1
          AND (resource = ? OR resource = '*')
          AND (action = ? OR action = '*')
        ORDER BY priority DESC
      `).all(resource, action) as DynamicRule[];

      // Update cache
      this.ruleCache.set(cacheKey, rules);
      this.lastCacheUpdate = Date.now();

      return rules;
    } catch (error) {
      logger.error('Error getting applicable rules', error);
      return [];
    }
  }

  /**
   * Evaluate a single rule against context
   */
  private async evaluateRule(rule: DynamicRule, context: RuleContext): Promise<{
    applies: boolean;
    granted: boolean;
    reason: string;
  }> {
    try {
      // Create safe evaluation context
      const evalContext = this.createEvaluationContext(context);

      // Evaluate the condition
      const result = this.safeEvaluate(rule.condition, evalContext);

      if (typeof result === 'boolean') {
        return {
          applies: true,
          granted: result,
          reason: `Rule "${rule.name}" evaluated to ${result}`
        };
      } else {
        return {
          applies: false,
          granted: false,
          reason: `Rule "${rule.name}" did not return a boolean value`
        };
      }
    } catch (error) {
      logger.error(`Error evaluating rule ${rule.name}:`, error);
      return {
        applies: false,
        granted: false,
        reason: `Rule "${rule.name}" evaluation failed: ${error.message}`
      };
    }
  }

  /**
   * Create a safe evaluation context for rules
   */
  private createEvaluationContext(context: RuleContext): Record<string, any> {
    return {
      user: {
        id: context.user.id,
        role: context.user.role,
        department: context.user.department,
        seniority: context.user.seniority || 0,
        attributes: context.user.attributes || {}
      },
      resource: {
        id: context.resource.id,
        type: context.resource.type,
        attributes: context.resource.attributes || {},
        owner: context.resource.owner,
        department: context.resource.department
      },
      environment: {
        timestamp: context.environment.timestamp,
        hour: context.environment.timestamp.getHours(),
        dayOfWeek: context.environment.timestamp.getDay(),
        ipAddress: context.environment.ipAddress,
        sessionDuration: context.environment.sessionDuration || 0
      },
      // Helper functions
      isOwner: () => context.user.id === context.resource.owner,
      isBusinessHours: () => {
        const hour = context.environment.timestamp.getHours();
        const day = context.environment.timestamp.getDay();
        return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
      },
      hasAttribute: (key: string, value?: any) => {
        const userValue = context.user.attributes?.[key];
        return value === undefined ? userValue !== undefined : userValue === value;
      },
      resourceHasAttribute: (key: string, value?: any) => {
        const resourceValue = context.resource.attributes?.[key];
        return value === undefined ? resourceValue !== undefined : resourceValue === value;
      }
    };
  }

  /**
   * Safely evaluate JavaScript expressions
   */
  private safeEvaluate(condition: string, context: Record<string, any>): any {
    // Create a restricted evaluation environment
    const allowedGlobals = {
      Math,
      Date,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
      String,
      Number,
      Boolean,
      Array,
      Object
    };

    // Build the evaluation string
    const contextKeys = Object.keys(context);
    const contextValues = contextKeys.map(key => context[key]);

    const func = new Function(
      ...contextKeys,
      ...Object.keys(allowedGlobals),
      `"use strict"; return (${condition});`
    );

    return func(...contextValues, ...Object.values(allowedGlobals));
  }

  /**
   * Validate condition syntax
   */
  private async validateCondition(condition: string): Promise<boolean> {
    try {
      // Create a test context
      const testContext = {
        user: { id: 1, role: 'user', department: 'IT' },
        resource: { id: 1, type: 'ticket', owner: 1 },
        environment: { timestamp: new Date(), hour: 10, dayOfWeek: 2 },
        isOwner: () => true,
        isBusinessHours: () => true,
        hasAttribute: () => false,
        resourceHasAttribute: () => false
      };

      // Try to evaluate with test context
      this.safeEvaluate(condition, testContext);
      return true;
    } catch (error) {
      logger.error('Condition validation failed', error);
      return false;
    }
  }

  /**
   * Generate a unique rule ID
   */
  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  /**
   * Clear the rule cache
   */
  private clearCache(): void {
    this.ruleCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Get rule evaluation history for analysis
   */
  getRuleEvaluationHistory(ruleId: string, limit: number = 100): any[] {
    try {
      return db.prepare(`
        SELECT * FROM dynamic_rule_evaluations
        WHERE rule_id = ?
        ORDER BY evaluated_at DESC
        LIMIT ?
      `).all(ruleId, limit) as any[];
    } catch (error) {
      logger.error('Error getting rule evaluation history', error);
      return [];
    }
  }

  /**
   * Log rule evaluation for analysis
   */
  private logRuleEvaluation(
    ruleId: string,
    userId: number,
    granted: boolean,
    context: RuleContext
  ): void {
    try {
      db.prepare(`
        INSERT INTO dynamic_rule_evaluations
        (rule_id, user_id, granted, context_data, evaluated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(ruleId, userId, granted ? 1 : 0, JSON.stringify(context));
    } catch (error) {
      logger.error('Error logging rule evaluation', error);
    }
  }

  /**
   * Initialize default dynamic rules
   */
  async initializeDefaultRules(): Promise<void> {
    const defaultRules = [
      {
        name: 'Ticket Owner Can Edit',
        description: 'Ticket owner can always edit their own tickets',
        resource: 'tickets',
        action: 'update',
        condition: 'isOwner()',
        priority: 100,
        is_active: true,
        created_by: 1
      },
      {
        name: 'Business Hours Only for Non-Critical',
        description: 'Non-critical actions only during business hours',
        resource: '*',
        action: 'create',
        condition: 'isBusinessHours() || user.role === "admin" || resourceHasAttribute("priority", "critical")',
        priority: 50,
        is_active: true,
        created_by: 1
      },
      {
        name: 'Department Resource Access',
        description: 'Users can only access resources from their department',
        resource: '*',
        action: 'read',
        condition: 'user.department === resource.department || user.role === "admin"',
        priority: 75,
        is_active: true,
        created_by: 1
      },
      {
        name: 'Senior Staff Extended Access',
        description: 'Senior staff (seniority > 5) get extended access',
        resource: 'tickets',
        action: 'assign',
        condition: 'user.seniority > 5 || user.role === "manager" || user.role === "admin"',
        priority: 60,
        is_active: true,
        created_by: 1
      }
    ];

    for (const rule of defaultRules) {
      // Check if rule already exists
      const existing = db.prepare(`
        SELECT id FROM dynamic_permission_rules WHERE name = ?
      `).get(rule.name);

      if (!existing) {
        await this.createRule(rule);
      }
    }

    logger.info('Default dynamic permission rules initialized');
  }
}

export const dynamicPermissionManager = new DynamicPermissionManager();
export default dynamicPermissionManager;