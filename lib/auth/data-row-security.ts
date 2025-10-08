import db from '../db/connection';
import { logger } from '../monitoring/logger';

export interface RowSecurityPolicy {
  id: string;
  name: string;
  table_name: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  condition: string; // SQL WHERE clause
  roles: string[];
  is_active: boolean;
  priority: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface SecurityContext {
  userId: number;
  userRole: string;
  userDepartment?: string;
  sessionId?: string;
  ipAddress?: string;
}

export interface QueryModification {
  originalQuery: string;
  secureQuery: string;
  appliedPolicies: string[];
  parameters: any[];
}

class DataRowSecurityManager {
  private policyCache = new Map<string, RowSecurityPolicy[]>();
  private cacheExpiry = 10 * 60 * 1000; // 10 minutes
  private lastCacheUpdate = 0;

  /**
   * Apply row-level security to a SELECT query
   */
  secureSelectQuery(
    query: string,
    tableName: string,
    context: SecurityContext,
    existingParams: any[] = []
  ): QueryModification {
    try {
      const policies = this.getPoliciesForTable(tableName, 'SELECT', context.userRole);

      if (policies.length === 0) {
        return {
          originalQuery: query,
          secureQuery: query,
          appliedPolicies: [],
          parameters: existingParams
        };
      }

      let secureQuery = query;
      const appliedPolicies: string[] = [];
      let newParams = [...existingParams];

      // Apply each policy as additional WHERE conditions
      for (const policy of policies) {
        const condition = this.interpolateCondition(policy.condition, context);

        if (condition.sql) {
          // Add the security condition to the query
          if (secureQuery.toUpperCase().includes('WHERE')) {
            secureQuery = secureQuery.replace(
              /WHERE/i,
              `WHERE (${condition.sql}) AND`
            );
          } else {
            // Find the FROM clause and add WHERE after it
            secureQuery = secureQuery.replace(
              new RegExp(`FROM\\s+${tableName}`, 'i'),
              `FROM ${tableName} WHERE (${condition.sql})`
            );
          }

          newParams = newParams.concat(condition.params);
          appliedPolicies.push(policy.name);
        }
      }

      return {
        originalQuery: query,
        secureQuery,
        appliedPolicies,
        parameters: newParams
      };
    } catch (error) {
      logger.error('Error securing SELECT query', error);
      return {
        originalQuery: query,
        secureQuery: query,
        appliedPolicies: [],
        parameters: existingParams
      };
    }
  }

  /**
   * Check if INSERT operation is allowed
   */
  checkInsertPermission(
    tableName: string,
    data: Record<string, any>,
    context: SecurityContext
  ): { allowed: boolean; reason?: string; appliedPolicies: string[] } {
    try {
      const policies = this.getPoliciesForTable(tableName, 'INSERT', context.userRole);

      if (policies.length === 0) {
        return { allowed: true, appliedPolicies: [] };
      }

      const appliedPolicies: string[] = [];

      for (const policy of policies) {
        const result = this.evaluateInsertPolicy(policy, data, context);
        appliedPolicies.push(policy.name);

        if (!result.allowed) {
          return {
            allowed: false,
            reason: result.reason,
            appliedPolicies
          };
        }
      }

      return { allowed: true, appliedPolicies };
    } catch (error) {
      logger.error('Error checking INSERT permission', error);
      return {
        allowed: false,
        reason: 'Error evaluating INSERT policies',
        appliedPolicies: []
      };
    }
  }

  /**
   * Check if UPDATE operation is allowed and modify the query
   */
  secureUpdateQuery(
    query: string,
    tableName: string,
    context: SecurityContext,
    existingParams: any[] = []
  ): QueryModification & { allowed: boolean; reason?: string } {
    try {
      const policies = this.getPoliciesForTable(tableName, 'UPDATE', context.userRole);

      if (policies.length === 0) {
        return {
          originalQuery: query,
          secureQuery: query,
          appliedPolicies: [],
          parameters: existingParams,
          allowed: true
        };
      }

      let secureQuery = query;
      const appliedPolicies: string[] = [];
      let newParams = [...existingParams];

      // Apply each policy as additional WHERE conditions
      for (const policy of policies) {
        const condition = this.interpolateCondition(policy.condition, context);

        if (condition.sql) {
          // Add the security condition to the UPDATE WHERE clause
          if (secureQuery.toUpperCase().includes('WHERE')) {
            secureQuery = secureQuery.replace(
              /WHERE/i,
              `WHERE (${condition.sql}) AND`
            );
          } else {
            // Add WHERE clause before any trailing parts
            secureQuery = secureQuery.replace(
              new RegExp(`(UPDATE\\s+${tableName}\\s+SET\\s+.+?)(?=\\s*$|\\s+RETURNING)`, 'i'),
              `$1 WHERE (${condition.sql})`
            );
          }

          newParams = newParams.concat(condition.params);
          appliedPolicies.push(policy.name);
        }
      }

      return {
        originalQuery: query,
        secureQuery,
        appliedPolicies,
        parameters: newParams,
        allowed: true
      };
    } catch (error) {
      logger.error('Error securing UPDATE query', error);
      return {
        originalQuery: query,
        secureQuery: query,
        appliedPolicies: [],
        parameters: existingParams,
        allowed: false,
        reason: 'Error applying UPDATE policies'
      };
    }
  }

  /**
   * Check if DELETE operation is allowed and modify the query
   */
  secureDeleteQuery(
    query: string,
    tableName: string,
    context: SecurityContext,
    existingParams: any[] = []
  ): QueryModification & { allowed: boolean; reason?: string } {
    try {
      const policies = this.getPoliciesForTable(tableName, 'DELETE', context.userRole);

      if (policies.length === 0) {
        return {
          originalQuery: query,
          secureQuery: query,
          appliedPolicies: [],
          parameters: existingParams,
          allowed: true
        };
      }

      let secureQuery = query;
      const appliedPolicies: string[] = [];
      let newParams = [...existingParams];

      // Apply each policy as additional WHERE conditions
      for (const policy of policies) {
        const condition = this.interpolateCondition(policy.condition, context);

        if (condition.sql) {
          // Add the security condition to the DELETE WHERE clause
          if (secureQuery.toUpperCase().includes('WHERE')) {
            secureQuery = secureQuery.replace(
              /WHERE/i,
              `WHERE (${condition.sql}) AND`
            );
          } else {
            secureQuery = secureQuery.replace(
              new RegExp(`DELETE\\s+FROM\\s+${tableName}`, 'i'),
              `DELETE FROM ${tableName} WHERE (${condition.sql})`
            );
          }

          newParams = newParams.concat(condition.params);
          appliedPolicies.push(policy.name);
        }
      }

      return {
        originalQuery: query,
        secureQuery,
        appliedPolicies,
        parameters: newParams,
        allowed: true
      };
    } catch (error) {
      logger.error('Error securing DELETE query', error);
      return {
        originalQuery: query,
        secureQuery: query,
        appliedPolicies: [],
        parameters: existingParams,
        allowed: false,
        reason: 'Error applying DELETE policies'
      };
    }
  }

  /**
   * Create a new row security policy
   */
  createPolicy(policy: Omit<RowSecurityPolicy, 'id' | 'created_at' | 'updated_at'>): string | null {
    try {
      // Validate the condition syntax
      const isValid = this.validateCondition(policy.condition);
      if (!isValid) {
        throw new Error('Invalid condition syntax');
      }

      const policyId = this.generatePolicyId();

      db.prepare(`
        INSERT INTO row_security_policies
        (id, name, table_name, operation, condition, roles, is_active, priority, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        policyId,
        policy.name,
        policy.table_name,
        policy.operation,
        policy.condition,
        JSON.stringify(policy.roles),
        policy.is_active ? 1 : 0,
        policy.priority,
        policy.created_by
      );

      this.clearCache();
      return policyId;
    } catch (error) {
      logger.error('Error creating row security policy', error);
      return null;
    }
  }

  /**
   * Update an existing row security policy
   */
  updatePolicy(policyId: string, updates: Partial<RowSecurityPolicy>): boolean {
    try {
      if (updates.condition) {
        const isValid = this.validateCondition(updates.condition);
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

      if (updates.condition !== undefined) {
        fields.push('condition = ?');
        values.push(updates.condition);
      }

      if (updates.roles !== undefined) {
        fields.push('roles = ?');
        values.push(JSON.stringify(updates.roles));
      }

      if (updates.is_active !== undefined) {
        fields.push('is_active = ?');
        values.push(updates.is_active ? 1 : 0);
      }

      if (updates.priority !== undefined) {
        fields.push('priority = ?');
        values.push(updates.priority);
      }

      if (fields.length === 0) return false;

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(policyId);

      const stmt = db.prepare(`
        UPDATE row_security_policies
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
      logger.error('Error updating row security policy', error);
      return false;
    }
  }

  /**
   * Delete a row security policy
   */
  deletePolicy(policyId: string): boolean {
    try {
      const stmt = db.prepare(`
        DELETE FROM row_security_policies WHERE id = ?
      `);

      const result = stmt.run(policyId);

      if (result.changes > 0) {
        this.clearCache();
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error deleting row security policy', error);
      return false;
    }
  }

  /**
   * Get all row security policies
   */
  getAllPolicies(): RowSecurityPolicy[] {
    try {
      const policies = db.prepare(`
        SELECT * FROM row_security_policies
        ORDER BY table_name, priority DESC, created_at DESC
      `).all() as any[];

      return policies.map(policy => ({
        ...policy,
        roles: JSON.parse(policy.roles)
      }));
    } catch (error) {
      logger.error('Error getting all row security policies', error);
      return [];
    }
  }

  /**
   * Get policies for a specific table and operation
   */
  private getPoliciesForTable(
    tableName: string,
    operation: string,
    userRole: string
  ): RowSecurityPolicy[] {
    const cacheKey = `${tableName}:${operation}:${userRole}`;

    // Check cache
    if (this.isCacheValid() && this.policyCache.has(cacheKey)) {
      return this.policyCache.get(cacheKey)!;
    }

    try {
      const policies = db.prepare(`
        SELECT * FROM row_security_policies
        WHERE is_active = 1
          AND table_name = ?
          AND (operation = ? OR operation = 'ALL')
          AND (json_extract(roles, '$') LIKE '%"' || ? || '"%' OR json_extract(roles, '$') = '["*"]')
        ORDER BY priority DESC
      `).all(tableName, operation, userRole) as any[];

      const parsedPolicies = policies.map(policy => ({
        ...policy,
        roles: JSON.parse(policy.roles)
      }));

      // Update cache
      this.policyCache.set(cacheKey, parsedPolicies);
      this.lastCacheUpdate = Date.now();

      return parsedPolicies;
    } catch (error) {
      logger.error('Error getting policies for table', error);
      return [];
    }
  }

  /**
   * Interpolate condition with security context
   */
  private interpolateCondition(
    condition: string,
    context: SecurityContext
  ): { sql: string; params: any[] } {
    const params: any[] = [];
    let sql = condition;

    // Replace context variables with parameter placeholders
    const replacements = [
      { pattern: /\$USER_ID\b/g, value: context.userId },
      { pattern: /\$USER_ROLE\b/g, value: context.userRole },
      { pattern: /\$USER_DEPARTMENT\b/g, value: context.userDepartment },
      { pattern: /\$SESSION_ID\b/g, value: context.sessionId },
      { pattern: /\$IP_ADDRESS\b/g, value: context.ipAddress },
      { pattern: /\$CURRENT_TIMESTAMP\b/g, value: new Date().toISOString() }
    ];

    for (const replacement of replacements) {
      if (replacement.pattern.test(sql)) {
        sql = sql.replace(replacement.pattern, '?');
        params.push(replacement.value);
      }
    }

    return { sql, params };
  }

  /**
   * Evaluate INSERT policy
   */
  private evaluateInsertPolicy(
    policy: RowSecurityPolicy,
    data: Record<string, any>,
    context: SecurityContext
  ): { allowed: boolean; reason?: string } {
    try {
      // For INSERT policies, we need to check if the data being inserted
      // would be accessible by the user after insertion

      // This is a simplified implementation
      // In a real-world scenario, you'd want to build a more sophisticated
      // policy evaluation engine

      const condition = policy.condition;

      // Check for ownership conditions
      if (condition.includes('user_id = $USER_ID')) {
        if (data.user_id !== context.userId) {
          return {
            allowed: false,
            reason: 'Cannot insert data for another user'
          };
        }
      }

      // Check for department conditions
      if (condition.includes('department') && context.userDepartment) {
        const departmentField = this.extractDepartmentField(condition);
        if (departmentField && data[departmentField] !== context.userDepartment) {
          return {
            allowed: false,
            reason: 'Cannot insert data for another department'
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Error evaluating INSERT policy', error);
      return {
        allowed: false,
        reason: 'Error evaluating policy'
      };
    }
  }

  /**
   * Extract department field from condition
   */
  private extractDepartmentField(condition: string): string | null {
    const match = condition.match(/(\w+)\s*=\s*\$USER_DEPARTMENT/);
    return match ? match[1] : null;
  }

  /**
   * Validate condition syntax
   */
  private validateCondition(condition: string): boolean {
    try {
      // Basic validation - check for SQL injection patterns
      const dangerousPatterns = [
        /;\s*(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER)\s/i,
        /UNION\s+SELECT/i,
        /--/,
        /\/\*/,
        /\*\//,
        /xp_/i,
        /sp_/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(condition)) {
          return false;
        }
      }

      // Check for valid variable references
      const validVariables = [
        '$USER_ID',
        '$USER_ROLE',
        '$USER_DEPARTMENT',
        '$SESSION_ID',
        '$IP_ADDRESS',
        '$CURRENT_TIMESTAMP'
      ];

      const variablePattern = /\$\w+/g;
      const matches = condition.match(variablePattern);

      if (matches) {
        for (const match of matches) {
          if (!validVariables.includes(match)) {
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      logger.error('Error validating condition', error);
      return false;
    }
  }

  /**
   * Generate a unique policy ID
   */
  private generatePolicyId(): string {
    return `rls_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry;
  }

  /**
   * Clear the policy cache
   */
  private clearCache(): void {
    this.policyCache.clear();
    this.lastCacheUpdate = 0;
  }

  /**
   * Initialize default row-level security policies
   */
  async initializeDefaultPolicies(): Promise<void> {
    const defaultPolicies = [
      {
        name: 'Users can only see their own tickets',
        table_name: 'tickets',
        operation: 'SELECT' as const,
        condition: 'user_id = $USER_ID OR assigned_to = $USER_ID',
        roles: ['user'],
        is_active: true,
        priority: 100,
        created_by: 1
      },
      {
        name: 'Agents can see all tickets in their department',
        table_name: 'tickets',
        operation: 'SELECT' as const,
        condition: 'department_id IN (SELECT id FROM departments WHERE name = $USER_DEPARTMENT)',
        roles: ['agent'],
        is_active: true,
        priority: 90,
        created_by: 1
      },
      {
        name: 'Users can only update their own tickets',
        table_name: 'tickets',
        operation: 'UPDATE' as const,
        condition: 'user_id = $USER_ID',
        roles: ['user'],
        is_active: true,
        priority: 100,
        created_by: 1
      },
      {
        name: 'Users can only see their own comments',
        table_name: 'comments',
        operation: 'SELECT' as const,
        condition: 'user_id = $USER_ID OR ticket_id IN (SELECT id FROM tickets WHERE user_id = $USER_ID OR assigned_to = $USER_ID)',
        roles: ['user'],
        is_active: true,
        priority: 100,
        created_by: 1
      },
      {
        name: 'Department isolation for sensitive data',
        table_name: 'user_departments',
        operation: 'ALL' as const,
        condition: 'department_id IN (SELECT department_id FROM user_departments WHERE user_id = $USER_ID)',
        roles: ['user', 'agent'],
        is_active: true,
        priority: 95,
        created_by: 1
      }
    ];

    for (const policy of defaultPolicies) {
      // Check if policy already exists
      const existing = db.prepare(`
        SELECT id FROM row_security_policies WHERE name = ?
      `).get(policy.name);

      if (!existing) {
        this.createPolicy(policy);
      }
    }

    logger.info('Default row-level security policies initialized');
  }
}

export const dataRowSecurity = new DataRowSecurityManager();
export default dataRowSecurity;