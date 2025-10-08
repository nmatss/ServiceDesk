/**
 * GraphQL-Style Field Selection for REST APIs
 * Allows clients to specify which fields they want in responses, reducing payload size
 */

export interface FieldSelectionConfig {
  defaultFields: Record<string, string[]>;
  maxDepth: number;
  allowedRelations: Record<string, string[]>;
  securityRules: Record<string, {
    requiredRole?: string[];
    forbidden?: string[];
    conditions?: Array<(context: any) => boolean>;
  }>;
  caching: {
    enabled: boolean;
    ttl: number;
  };
  validation: {
    strictMode: boolean;
    allowUnknownFields: boolean;
  };
}

export interface SelectionQuery {
  fields?: string[];
  include?: Record<string, SelectionQuery>;
  exclude?: string[];
  depth?: number;
}

export interface SelectionContext {
  userId?: string;
  userRole?: string;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export interface SelectionResult<T = any> {
  data: T;
  metadata: {
    requestedFields: string[];
    includedFields: string[];
    excludedFields: string[];
    appliedSecurity: string[];
    optimizations: string[];
    originalSize: number;
    reducedSize: number;
    compressionRatio: number;
  };
}

export interface FieldMap {
  path: string;
  alias?: string;
  transform?: (value: any, context: SelectionContext) => any;
  security?: {
    requiredRole?: string[];
    condition?: (context: SelectionContext) => boolean;
  };
  relations?: string[];
}

export class FieldSelector {
  private static instance: FieldSelector;
  private config: FieldSelectionConfig;
  private fieldMaps = new Map<string, Map<string, FieldMap>>();
  private selectionCache = new Map<string, { result: any; timestamp: number }>();

  private constructor(config: FieldSelectionConfig) {
    this.config = config;
    this.setupDefaultFieldMaps();
    this.startCacheCleanup();
  }

  static getInstance(config?: FieldSelectionConfig): FieldSelector {
    if (!FieldSelector.instance && config) {
      FieldSelector.instance = new FieldSelector(config);
    }
    return FieldSelector.instance;
  }

  /**
   * Parse field selection query from request
   */
  parseFieldSelection(query: {
    fields?: string;
    include?: string;
    exclude?: string;
    depth?: string;
  }): SelectionQuery {
    const selection: SelectionQuery = {};

    // Parse fields parameter (comma-separated)
    if (query.fields) {
      selection.fields = query.fields.split(',').map(f => f.trim());
    }

    // Parse include parameter (dot notation with relations)
    if (query.include) {
      selection.include = this.parseIncludeString(query.include);
    }

    // Parse exclude parameter
    if (query.exclude) {
      selection.exclude = query.exclude.split(',').map(f => f.trim());
    }

    // Parse depth
    if (query.depth) {
      const depth = parseInt(query.depth, 10);
      if (!isNaN(depth) && depth <= this.config.maxDepth) {
        selection.depth = depth;
      }
    }

    return selection;
  }

  /**
   * Apply field selection to data
   */
  async selectFields<T>(
    entityName: string,
    data: T | T[],
    selection: SelectionQuery,
    context: SelectionContext = {}
  ): Promise<SelectionResult<T | T[]>> {
    const startTime = Date.now();

    // Generate cache key
    const cacheKey = this.generateCacheKey(entityName, selection, context);

    // Check cache for selection metadata
    if (this.config.caching.enabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        const result = Array.isArray(data)
          ? data.map(item => this.applySelectionToItem(item, cached.result, context))
          : this.applySelectionToItem(data, cached.result, context);

        return this.wrapResult(result, cached.result.metadata);
      }
    }

    // Resolve field selection
    const resolvedSelection = await this.resolveSelection(entityName, selection, context);

    // Apply selection to data
    let selectedData: T | T[];
    if (Array.isArray(data)) {
      selectedData = data.map(item => this.applySelectionToItem(item, resolvedSelection, context));
    } else {
      selectedData = this.applySelectionToItem(data, resolvedSelection, context);
    }

    // Calculate metadata
    const originalSize = this.calculateSize(data);
    const reducedSize = this.calculateSize(selectedData);

    const metadata = {
      requestedFields: selection.fields || [],
      includedFields: resolvedSelection.includedFields,
      excludedFields: resolvedSelection.excludedFields,
      appliedSecurity: resolvedSelection.appliedSecurity,
      optimizations: resolvedSelection.optimizations,
      originalSize,
      reducedSize,
      compressionRatio: originalSize > 0 ? reducedSize / originalSize : 1
    };

    // Cache resolved selection
    if (this.config.caching.enabled) {
      this.cacheSelection(cacheKey, { result: resolvedSelection, metadata });
    }

    return this.wrapResult(selectedData, metadata);
  }

  /**
   * Register field mappings for an entity
   */
  registerFieldMaps(entityName: string, fields: Record<string, FieldMap>): void {
    const fieldMap = new Map<string, FieldMap>();

    for (const [fieldName, mapping] of Object.entries(fields)) {
      fieldMap.set(fieldName, mapping);
    }

    this.fieldMaps.set(entityName, fieldMap);
  }

  /**
   * Generate optimized SQL SELECT clause
   */
  generateSelectClause(
    entityName: string,
    tableName: string,
    selection: SelectionQuery,
    context: SelectionContext = {}
  ): {
    selectClause: string;
    joins: string[];
    securityConditions: string[];
  } {
    const fieldMap = this.fieldMaps.get(entityName);
    if (!fieldMap) {
      return {
        selectClause: `${tableName}.*`,
        joins: [],
        securityConditions: []
      };
    }

    const selectedFields: string[] = [];
    const joins: string[] = [];
    const securityConditions: string[] = [];

    // Determine which fields to include
    const fieldsToInclude = this.determineFieldsToInclude(entityName, selection, context);

    for (const fieldName of fieldsToInclude.includedFields) {
      const mapping = fieldMap.get(fieldName);
      if (!mapping) continue;

      // Check security
      if (mapping.security) {
        if (!this.checkFieldSecurity(mapping.security, context)) {
          securityConditions.push(`Field ${fieldName} access denied`);
          continue;
        }
      }

      // Add field to selection
      const fieldPath = mapping.path.startsWith(tableName)
        ? mapping.path
        : `${tableName}.${mapping.path}`;

      if (mapping.alias) {
        selectedFields.push(`${fieldPath} AS ${mapping.alias}`);
      } else {
        selectedFields.push(fieldPath);
      }

      // Add required joins
      if (mapping.relations) {
        for (const relation of mapping.relations) {
          if (this.config.allowedRelations[entityName]?.includes(relation)) {
            joins.push(this.generateJoinClause(tableName, relation));
          }
        }
      }
    }

    return {
      selectClause: selectedFields.length > 0 ? selectedFields.join(', ') : `${tableName}.*`,
      joins: [...new Set(joins)], // Remove duplicates
      securityConditions
    };
  }

  /**
   * Create middleware for automatic field selection
   */
  middleware(entityName: string) {
    return async (req: any, res: any, next: any) => {
      // Parse field selection from query parameters
      const selection = this.parseFieldSelection(req.query);

      // Extract context from request
      const context: SelectionContext = {
        userId: req.user?.id,
        userRole: req.user?.role,
        permissions: req.user?.permissions || [],
        metadata: { userAgent: req.headers['user-agent'] }
      };

      // Store selection in request for use in route handlers
      req.fieldSelection = { selection, context, entityName };

      next();
    };
  }

  /**
   * Analyze field usage patterns
   */
  analyzeFieldUsage(usageData: Array<{
    entityName: string;
    requestedFields: string[];
    includedFields: string[];
    timestamp: Date;
    compressionRatio: number;
  }>): {
    entityStats: Map<string, {
      totalRequests: number;
      averageCompressionRatio: number;
      popularFields: Array<{ field: string; usage: number }>;
      unusedFields: string[];
    }>;
    recommendations: string[];
  } {
    const entityStats = new Map();
    const recommendations: string[] = [];

    // Group by entity
    const groupedData = new Map<string, typeof usageData>();
    for (const usage of usageData) {
      if (!groupedData.has(usage.entityName)) {
        groupedData.set(usage.entityName, []);
      }
      groupedData.get(usage.entityName)!.push(usage);
    }

    // Analyze each entity
    for (const [entityName, entityData] of groupedData.entries()) {
      const fieldUsage = new Map<string, number>();
      let totalCompressionRatio = 0;

      // Count field usage
      for (const usage of entityData) {
        totalCompressionRatio += usage.compressionRatio;

        for (const field of usage.includedFields) {
          fieldUsage.set(field, (fieldUsage.get(field) || 0) + 1);
        }
      }

      // Calculate statistics
      const totalRequests = entityData.length;
      const averageCompressionRatio = totalCompressionRatio / totalRequests;

      // Find popular and unused fields
      const popularFields = Array.from(fieldUsage.entries())
        .map(([field, usage]) => ({ field, usage: (usage / totalRequests) * 100 }))
        .sort((a, b) => b.usage - a.usage);

      const defaultFields = this.config.defaultFields[entityName] || [];
      const unusedFields = defaultFields.filter(field => !fieldUsage.has(field));

      entityStats.set(entityName, {
        totalRequests,
        averageCompressionRatio,
        popularFields,
        unusedFields
      });

      // Generate recommendations
      if (averageCompressionRatio > 0.8) {
        recommendations.push(`Consider reducing default fields for ${entityName} (only ${Math.round((1 - averageCompressionRatio) * 100)}% reduction)`);
      }

      if (unusedFields.length > 0) {
        recommendations.push(`Remove unused default fields for ${entityName}: ${unusedFields.join(', ')}`);
      }

      const lowUsageFields = popularFields.filter(f => f.usage < 10);
      if (lowUsageFields.length > 0) {
        recommendations.push(`Consider removing low-usage fields from ${entityName} defaults: ${lowUsageFields.map(f => f.field).join(', ')}`);
      }
    }

    return { entityStats, recommendations };
  }

  private parseIncludeString(includeStr: string): Record<string, SelectionQuery> {
    const include: Record<string, SelectionQuery> = {};

    const relations = includeStr.split(',').map(r => r.trim());

    for (const relation of relations) {
      const parts = relation.split('.');
      let current = include;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (i === parts.length - 1) {
          // Last part - create the selection
          current[part] = current[part] || {};
        } else {
          // Intermediate part - ensure include exists
          current[part] = current[part] || {};
          current[part].include = current[part].include || {};
          current = current[part].include!;
        }
      }
    }

    return include;
  }

  private async resolveSelection(
    entityName: string,
    selection: SelectionQuery,
    context: SelectionContext
  ): Promise<{
    includedFields: string[];
    excludedFields: string[];
    appliedSecurity: string[];
    optimizations: string[];
  }> {
    const result = this.determineFieldsToInclude(entityName, selection, context);

    // Apply security rules
    const securityRules = this.config.securityRules[entityName];
    if (securityRules) {
      const securityResult = await this.applySecurityRules(
        result.includedFields,
        securityRules,
        context
      );

      result.includedFields = securityResult.allowedFields;
      result.excludedFields.push(...securityResult.forbiddenFields);
      result.appliedSecurity = securityResult.appliedRules;
    }

    return result;
  }

  private determineFieldsToInclude(
    entityName: string,
    selection: SelectionQuery,
    context: SelectionContext
  ): {
    includedFields: string[];
    excludedFields: string[];
    appliedSecurity: string[];
    optimizations: string[];
  } {
    const defaultFields = this.config.defaultFields[entityName] || [];
    const fieldMap = this.fieldMaps.get(entityName);

    let includedFields: string[];

    if (selection.fields && selection.fields.length > 0) {
      // Use explicitly requested fields
      includedFields = selection.fields;
    } else {
      // Use default fields
      includedFields = [...defaultFields];
    }

    // Apply exclusions
    const excludedFields = selection.exclude || [];
    includedFields = includedFields.filter(field => !excludedFields.includes(field));

    // Validate fields exist
    if (this.config.validation.strictMode && fieldMap) {
      const validFields = includedFields.filter(field => fieldMap.has(field));
      const invalidFields = includedFields.filter(field => !fieldMap.has(field));

      if (!this.config.validation.allowUnknownFields) {
        includedFields = validFields;
        excludedFields.push(...invalidFields);
      }
    }

    return {
      includedFields,
      excludedFields,
      appliedSecurity: [],
      optimizations: []
    };
  }

  private async applySecurityRules(
    fields: string[],
    securityRules: any,
    context: SelectionContext
  ): Promise<{
    allowedFields: string[];
    forbiddenFields: string[];
    appliedRules: string[];
  }> {
    const allowedFields: string[] = [];
    const forbiddenFields: string[] = [];
    const appliedRules: string[] = [];

    for (const field of fields) {
      let allowed = true;

      // Check role requirements
      if (securityRules.requiredRole && context.userRole) {
        if (!securityRules.requiredRole.includes(context.userRole)) {
          allowed = false;
          appliedRules.push(`Role check failed for field ${field}`);
        }
      }

      // Check forbidden fields
      if (securityRules.forbidden && securityRules.forbidden.includes(field)) {
        allowed = false;
        appliedRules.push(`Field ${field} is forbidden`);
      }

      // Check conditions
      if (securityRules.conditions) {
        for (const condition of securityRules.conditions) {
          if (!condition(context)) {
            allowed = false;
            appliedRules.push(`Condition check failed for field ${field}`);
            break;
          }
        }
      }

      if (allowed) {
        allowedFields.push(field);
      } else {
        forbiddenFields.push(field);
      }
    }

    return { allowedFields, forbiddenFields, appliedRules };
  }

  private applySelectionToItem(item: any, selection: any, context: SelectionContext): any {
    if (!item || typeof item !== 'object') {
      return item;
    }

    const result: any = {};

    // Include selected fields
    for (const field of selection.includedFields) {
      if (item.hasOwnProperty(field)) {
        const fieldMap = this.fieldMaps.get('default')?.get(field);

        if (fieldMap?.transform) {
          result[field] = fieldMap.transform(item[field], context);
        } else {
          result[field] = item[field];
        }
      }
    }

    // Handle includes (relations)
    if (selection.include) {
      for (const [relation, relationSelection] of Object.entries(selection.include)) {
        if (item[relation]) {
          if (Array.isArray(item[relation])) {
            result[relation] = item[relation].map((relItem: any) =>
              this.applySelectionToItem(relItem, relationSelection, context)
            );
          } else {
            result[relation] = this.applySelectionToItem(item[relation], relationSelection, context);
          }
        }
      }
    }

    return result;
  }

  private checkFieldSecurity(security: any, context: SelectionContext): boolean {
    if (security.requiredRole && context.userRole) {
      return security.requiredRole.includes(context.userRole);
    }

    if (security.condition) {
      return security.condition(context);
    }

    return true;
  }

  private generateJoinClause(tableName: string, relation: string): string {
    // This would generate appropriate JOIN clauses based on relation configuration
    return `LEFT JOIN ${relation} ON ${tableName}.${relation}_id = ${relation}.id`;
  }

  private calculateSize(data: any): number {
    return JSON.stringify(data).length;
  }

  private wrapResult<T>(data: T, metadata: any): SelectionResult<T> {
    return { data, metadata };
  }

  private generateCacheKey(entityName: string, selection: SelectionQuery, context: SelectionContext): string {
    const key = JSON.stringify({
      entityName,
      selection,
      userRole: context.userRole,
      permissions: context.permissions
    });

    return `selection:${this.hash(key)}`;
  }

  private hash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private getFromCache(cacheKey: string): any {
    const cached = this.selectionCache.get(cacheKey);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.config.caching.ttl * 1000) {
      this.selectionCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  private cacheSelection(cacheKey: string, result: any): void {
    this.selectionCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const ttlMs = this.config.caching.ttl * 1000;

      for (const [key, entry] of this.selectionCache.entries()) {
        if (now - entry.timestamp > ttlMs) {
          this.selectionCache.delete(key);
        }
      }
    }, 60000);
  }

  private setupDefaultFieldMaps(): void {
    // Setup default field mappings for ServiceDesk entities
    this.registerFieldMaps('ticket', {
      id: { path: 'id' },
      title: { path: 'title' },
      description: { path: 'description' },
      status: { path: 'status_id', relations: ['statuses'] },
      priority: { path: 'priority_id', relations: ['priorities'] },
      category: { path: 'category_id', relations: ['categories'] },
      user: { path: 'user_id', relations: ['users'] },
      assignedAgent: { path: 'assigned_to', relations: ['users'], alias: 'assigned_agent' },
      createdAt: { path: 'created_at' },
      updatedAt: { path: 'updated_at' },
      resolvedAt: { path: 'resolved_at' }
    });

    this.registerFieldMaps('user', {
      id: { path: 'id' },
      name: { path: 'name' },
      email: { path: 'email', security: { requiredRole: ['admin', 'agent'] } },
      role: { path: 'role' },
      createdAt: { path: 'created_at' },
      lastLoginAt: { path: 'last_login_at', security: { requiredRole: ['admin'] } }
    });
  }
}

// Default configuration
export const defaultFieldSelectionConfig: FieldSelectionConfig = {
  defaultFields: {
    ticket: ['id', 'title', 'status', 'priority', 'createdAt', 'updatedAt'],
    user: ['id', 'name', 'role'],
    comment: ['id', 'content', 'createdAt', 'user'],
    category: ['id', 'name', 'color'],
    priority: ['id', 'name', 'level', 'color'],
    status: ['id', 'name', 'color', 'is_final']
  },
  maxDepth: 3,
  allowedRelations: {
    ticket: ['user', 'assignedAgent', 'category', 'priority', 'status', 'comments'],
    comment: ['user', 'ticket'],
    user: ['tickets', 'comments']
  },
  securityRules: {
    user: {
      requiredRole: ['admin', 'agent'],
      forbidden: ['password_hash', 'secret_key'],
      conditions: [
        (context) => context.userRole === 'admin' || context.userId === context.metadata?.targetUserId
      ]
    }
  },
  caching: {
    enabled: true,
    ttl: 300 // 5 minutes
  },
  validation: {
    strictMode: true,
    allowUnknownFields: false
  }
};

// Export factory function
export function createFieldSelector(config: FieldSelectionConfig = defaultFieldSelectionConfig): FieldSelector {
  return FieldSelector.getInstance(config);
}