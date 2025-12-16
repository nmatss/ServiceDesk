import db from '../db/connection';
import logger from '../monitoring/structured-logger';
import type {
  Permission,
  Role,
  CreatePermission,
  CreateRole
} from '../types/database';

// ========================================
// RBAC (Role-Based Access Control) System
// ========================================

/**
 * Sistema de controle de acesso baseado em papéis granular
 * Suporta hierarquia de papéis, permissões condicionais e papéis temporários
 */

// ========================================
// FUNÇÕES DE PERMISSÕES
// ========================================

export function createPermission(permissionData: CreatePermission): Permission | null {
  try {
    const stmt = db.prepare(`
      INSERT INTO permissions (name, description, resource, action, conditions)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      permissionData.name,
      permissionData.description,
      permissionData.resource,
      permissionData.action,
      permissionData.conditions
    );

    return getPermissionById(result.lastInsertRowid as number);
  } catch (error) {
    logger.error('Error creating permission', error);
    return null;
  }
}

export function getPermissionById(id: number): Permission | null {
  try {
    return db.prepare('SELECT * FROM permissions WHERE id = ?').get(id) as Permission || null;
  } catch (error) {
    logger.error('Error getting permission by ID', error);
    return null;
  }
}

export function getPermissionByName(name: string): Permission | null {
  try {
    return db.prepare('SELECT * FROM permissions WHERE name = ?').get(name) as Permission || null;
  } catch (error) {
    logger.error('Error getting permission by name', error);
    return null;
  }
}

export function getAllPermissions(): Permission[] {
  try {
    return db.prepare('SELECT * FROM permissions ORDER BY resource, action').all() as Permission[];
  } catch (error) {
    logger.error('Error getting all permissions', error);
    return [];
  }
}

export function getPermissionsByResource(resource: string): Permission[] {
  try {
    return db.prepare('SELECT * FROM permissions WHERE resource = ? ORDER BY action').all(resource) as Permission[];
  } catch (error) {
    logger.error('Error getting permissions by resource', error);
    return [];
  }
}

export function deletePermission(id: number): boolean {
  try {
    const result = db.prepare('DELETE FROM permissions WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error deleting permission', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE PAPÉIS (ROLES)
// ========================================

export function createRole(roleData: CreateRole): Role | null {
  try {
    const stmt = db.prepare(`
      INSERT INTO roles (name, display_name, description, is_system, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      roleData.name,
      roleData.display_name,
      roleData.description,
      roleData.is_system ? 1 : 0,
      roleData.is_active ? 1 : 0
    );

    return getRoleById(result.lastInsertRowid as number);
  } catch (error) {
    logger.error('Error creating role', error);
    return null;
  }
}

export function getRoleById(id: number): Role | null {
  try {
    return db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as Role || null;
  } catch (error) {
    logger.error('Error getting role by ID', error);
    return null;
  }
}

export function getRoleByName(name: string): Role | null {
  try {
    return db.prepare('SELECT * FROM roles WHERE name = ?').get(name) as Role || null;
  } catch (error) {
    logger.error('Error getting role by name', error);
    return null;
  }
}

export function getAllRoles(): Role[] {
  try {
    return db.prepare('SELECT * FROM roles WHERE is_active = 1 ORDER BY display_name').all() as Role[];
  } catch (error) {
    logger.error('Error getting all roles', error);
    return [];
  }
}

export function updateRole(id: number, updates: Partial<Omit<Role, 'id' | 'created_at'>>): boolean {
  try {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at' && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    }

    if (fields.length === 0) return false;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = db.prepare(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error updating role', error);
    return false;
  }
}

export function deleteRole(id: number): boolean {
  try {
    // Não permitir deletar papéis do sistema
    const role = getRoleById(id);
    if (!role || role.is_system) {
      return false;
    }

    const result = db.prepare('DELETE FROM roles WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error deleting role', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE RELACIONAMENTO ROLE-PERMISSION
// ========================================

export function assignPermissionToRole(roleId: number, permissionId: number, grantedBy?: number): boolean {
  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted_by)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(roleId, permissionId, grantedBy);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error assigning permission to role', error);
    return false;
  }
}

export function removePermissionFromRole(roleId: number, permissionId: number): boolean {
  try {
    const result = db.prepare(`
      DELETE FROM role_permissions
      WHERE role_id = ? AND permission_id = ?
    `).run(roleId, permissionId);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error removing permission from role', error);
    return false;
  }
}

export function getRolePermissions(roleId: number): Permission[] {
  try {
    return db.prepare(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.resource, p.action
    `).all(roleId) as Permission[];
  } catch (error) {
    logger.error('Error getting role permissions', error);
    return [];
  }
}

export function setRolePermissions(roleId: number, permissionIds: number[], grantedBy?: number): boolean {
  try {
    // Iniciar transação
    const transaction = db.transaction(() => {
      // Remover todas as permissões existentes
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);

      // Adicionar novas permissões
      const insertStmt = db.prepare(`
        INSERT INTO role_permissions (role_id, permission_id, granted_by)
        VALUES (?, ?, ?)
      `);

      for (const permissionId of permissionIds) {
        insertStmt.run(roleId, permissionId, grantedBy);
      }
    });

    transaction();
    return true;
  } catch (error) {
    logger.error('Error setting role permissions', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE RELACIONAMENTO USER-ROLE
// ========================================

export function assignRoleToUser(
  userId: number,
  roleId: number,
  grantedBy?: number,
  expiresAt?: string
): boolean {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_roles (user_id, role_id, granted_by, expires_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `);

    const result = stmt.run(userId, roleId, grantedBy, expiresAt);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error assigning role to user', error);
    return false;
  }
}

export function removeRoleFromUser(userId: number, roleId: number): boolean {
  try {
    const result = db.prepare(`
      UPDATE user_roles
      SET is_active = 0
      WHERE user_id = ? AND role_id = ?
    `).run(userId, roleId);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error removing role from user', error);
    return false;
  }
}

export function getUserRoles(userId: number): Role[] {
  try {
    return db.prepare(`
      SELECT r.* FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
        AND ur.is_active = 1
        AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
      ORDER BY r.display_name
    `).all(userId) as Role[];
  } catch (error) {
    logger.error('Error getting user roles', error);
    return [];
  }
}

export function getUserPermissions(userId: number): Permission[] {
  try {
    return db.prepare(`
      SELECT DISTINCT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
        AND ur.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
      ORDER BY p.resource, p.action
    `).all(userId) as Permission[];
  } catch (error) {
    logger.error('Error getting user permissions', error);
    return [];
  }
}

export function setUserRoles(userId: number, roleIds: number[], grantedBy?: number): boolean {
  try {
    const transaction = db.transaction(() => {
      // Desativar todas as roles existentes
      db.prepare('UPDATE user_roles SET is_active = 0 WHERE user_id = ?').run(userId);

      // Adicionar novas roles
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO user_roles (user_id, role_id, granted_by, is_active)
        VALUES (?, ?, ?, 1)
      `);

      for (const roleId of roleIds) {
        insertStmt.run(userId, roleId, grantedBy);
      }
    });

    transaction();
    return true;
  } catch (error) {
    logger.error('Error setting user roles', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE VERIFICAÇÃO DE PERMISSÕES
// ========================================

/**
 * Context object for permission evaluation
 */
export interface PermissionContext {
  userId?: number;
  ownerId?: number;
  userDepartment?: string;
  resourceDepartment?: string;
  value?: number;
  userRoleLevel?: number;
  [key: string]: unknown;
}

export function hasPermission(
  userId: number,
  resource: string,
  action: string,
  context?: PermissionContext
): boolean {
  try {
    const permissions = getUserPermissions(userId);

    // Verificar permissão exata
    const exactPermission = permissions.find(p =>
      p.resource === resource && p.action === action
    );

    if (exactPermission) {
      // Se há condições, verificar contexto
      if (exactPermission.conditions && context) {
        return evaluatePermissionConditions(exactPermission.conditions, context);
      }
      return true;
    }

    // Verificar permissão de "manage" (que inclui todas as ações)
    const managePermission = permissions.find(p =>
      p.resource === resource && p.action === 'manage'
    );

    if (managePermission) {
      if (managePermission.conditions && context) {
        return evaluatePermissionConditions(managePermission.conditions, context);
      }
      return true;
    }

    // Verificar permissão de admin (que inclui todos os recursos)
    const adminPermission = permissions.find(p =>
      p.resource === 'admin' && p.action === 'manage'
    );

    return !!adminPermission;
  } catch (error) {
    logger.error('Error checking permission', error);
    return false;
  }
}

export function hasRole(userId: number, roleName: string): boolean {
  try {
    const roles = getUserRoles(userId);
    return roles.some(role => role.name === roleName);
  } catch (error) {
    logger.error('Error checking role', error);
    return false;
  }
}

export function hasAnyRole(userId: number, roleNames: string[]): boolean {
  try {
    const roles = getUserRoles(userId);
    const userRoleNames = roles.map(role => role.name);
    return roleNames.some(roleName => userRoleNames.includes(roleName));
  } catch (error) {
    logger.error('Error checking any role', error);
    return false;
  }
}

export function hasAllRoles(userId: number, roleNames: string[]): boolean {
  try {
    const roles = getUserRoles(userId);
    const userRoleNames = roles.map(role => role.name);
    return roleNames.every(roleName => userRoleNames.includes(roleName));
  } catch (error) {
    logger.error('Error checking all roles', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE CONDIÇÕES CONTEXTUAIS
// ========================================

/**
 * Conditions object structure for permission evaluation
 */
interface ConditionsObject {
  owner_only?: boolean;
  department_only?: boolean;
  business_hours?: boolean;
  max_value?: number;
  min_role_level?: number;
  [key: string]: unknown;
}

function evaluatePermissionConditions(conditions: string, context: PermissionContext): boolean {
  try {
    const conditionsObj: ConditionsObject = JSON.parse(conditions);

    // Implementar lógica de avaliação de condições
    // Exemplos de condições:
    // - owner_only: usuário só pode ver/editar seus próprios recursos
    // - department_only: usuário só pode ver recursos do seu departamento
    // - business_hours: ação só permitida em horário comercial
    // - max_value: ação só permitida para valores até X

    for (const [key, value] of Object.entries(conditionsObj)) {
      switch (key) {
        case 'owner_only':
          if (value && context.userId !== context.ownerId) {
            return false;
          }
          break;

        case 'department_only':
          if (value && context.userDepartment !== context.resourceDepartment) {
            return false;
          }
          break;

        case 'business_hours':
          if (value && !isBusinessHours()) {
            return false;
          }
          break;

        case 'max_value':
          if (context.value && typeof value === 'number' && context.value > value) {
            return false;
          }
          break;

        case 'min_role_level':
          if (typeof value === 'number' && context.userRoleLevel !== undefined && context.userRoleLevel < value) {
            return false;
          }
          break;
      }
    }

    return true;
  } catch (error) {
    logger.error('Error evaluating permission conditions', error);
    return false;
  }
}

function isBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = domingo, 6 = sábado

  // Segunda a sexta, 8h às 18h
  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
}

// ========================================
// FUNÇÕES DE INICIALIZAÇÃO DO SISTEMA
// ========================================

export function initializeDefaultRolesAndPermissions(): boolean {
  try {
    const transaction = db.transaction(() => {
      // Criar permissões padrão
      const defaultPermissions: CreatePermission[] = [
        // Tickets
        { name: 'tickets:create', description: 'Create tickets', resource: 'tickets', action: 'create' },
        { name: 'tickets:read', description: 'View tickets', resource: 'tickets', action: 'read' },
        { name: 'tickets:update', description: 'Update tickets', resource: 'tickets', action: 'update' },
        { name: 'tickets:delete', description: 'Delete tickets', resource: 'tickets', action: 'delete' },
        { name: 'tickets:assign', description: 'Assign tickets', resource: 'tickets', action: 'assign' },
        { name: 'tickets:close', description: 'Close tickets', resource: 'tickets', action: 'close' },
        { name: 'tickets:manage', description: 'Full ticket management', resource: 'tickets', action: 'manage' },

        // Users
        { name: 'users:create', description: 'Create users', resource: 'users', action: 'create' },
        { name: 'users:read', description: 'View users', resource: 'users', action: 'read' },
        { name: 'users:update', description: 'Update users', resource: 'users', action: 'update' },
        { name: 'users:delete', description: 'Delete users', resource: 'users', action: 'delete' },
        { name: 'users:manage', description: 'Full user management', resource: 'users', action: 'manage' },

        // Reports
        { name: 'reports:view', description: 'View reports', resource: 'reports', action: 'read' },
        { name: 'reports:export', description: 'Export reports', resource: 'reports', action: 'export' },
        { name: 'reports:manage', description: 'Full report management', resource: 'reports', action: 'manage' },

        // Settings
        { name: 'settings:read', description: 'View settings', resource: 'settings', action: 'read' },
        { name: 'settings:update', description: 'Update settings', resource: 'settings', action: 'update' },
        { name: 'settings:manage', description: 'Full settings management', resource: 'settings', action: 'manage' },

        // Knowledge Base
        { name: 'knowledge_base:create', description: 'Create KB articles', resource: 'knowledge_base', action: 'create' },
        { name: 'knowledge_base:read', description: 'View KB articles', resource: 'knowledge_base', action: 'read' },
        { name: 'knowledge_base:update', description: 'Update KB articles', resource: 'knowledge_base', action: 'update' },
        { name: 'knowledge_base:delete', description: 'Delete KB articles', resource: 'knowledge_base', action: 'delete' },
        { name: 'knowledge_base:manage', description: 'Full KB management', resource: 'knowledge_base', action: 'manage' },

        // Analytics
        { name: 'analytics:view', description: 'View analytics', resource: 'analytics', action: 'read' },
        { name: 'analytics:export', description: 'Export analytics', resource: 'analytics', action: 'export' },
        { name: 'analytics:manage', description: 'Full analytics management', resource: 'analytics', action: 'manage' },

        // Audit
        { name: 'audit:read', description: 'View audit logs', resource: 'audit', action: 'read' },
        { name: 'audit:export', description: 'Export audit logs', resource: 'audit', action: 'export' },
        { name: 'audit:manage', description: 'Full audit management', resource: 'audit', action: 'manage' },

        // Admin (super permission)
        { name: 'admin:manage', description: 'Full system administration', resource: 'admin', action: 'manage' }
      ];

      // Inserir permissões se não existem
      const insertPermissionStmt = db.prepare(`
        INSERT OR IGNORE INTO permissions (name, description, resource, action)
        VALUES (?, ?, ?, ?)
      `);

      for (const permission of defaultPermissions) {
        insertPermissionStmt.run(
          permission.name,
          permission.description,
          permission.resource,
          permission.action
        );
      }

      // Criar papéis padrão
      const defaultRoles: CreateRole[] = [
        {
          name: 'admin',
          display_name: 'Administrador',
          description: 'Acesso completo ao sistema',
          is_system: true,
          is_active: true
        },
        {
          name: 'manager',
          display_name: 'Gerente',
          description: 'Gerenciamento de equipe e relatórios',
          is_system: true,
          is_active: true
        },
        {
          name: 'agent',
          display_name: 'Agente',
          description: 'Atendimento e resolução de tickets',
          is_system: true,
          is_active: true
        },
        {
          name: 'user',
          display_name: 'Usuário',
          description: 'Criação e acompanhamento de tickets',
          is_system: true,
          is_active: true
        },
        {
          name: 'read_only',
          display_name: 'Somente Leitura',
          description: 'Visualização de tickets e relatórios',
          is_system: true,
          is_active: true
        },
        {
          name: 'api_client',
          display_name: 'Cliente API',
          description: 'Acesso via API para integrações',
          is_system: true,
          is_active: true
        }
      ];

      // Inserir papéis se não existem
      const insertRoleStmt = db.prepare(`
        INSERT OR IGNORE INTO roles (name, display_name, description, is_system, is_active)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const role of defaultRoles) {
        insertRoleStmt.run(
          role.name,
          role.display_name,
          role.description,
          role.is_system ? 1 : 0,
          role.is_active ? 1 : 0
        );
      }

      // Atribuir permissões aos papéis
      setupDefaultRolePermissions();
    });

    transaction();
    return true;
  } catch (error) {
    logger.error('Error initializing roles and permissions', error);
    return false;
  }
}

function setupDefaultRolePermissions(): void {
  // Admin - todas as permissões
  const adminRole = getRoleByName('admin');
  if (adminRole) {
    const adminPermissions = ['admin:manage'];
    assignPermissionsToRole(adminRole.id, adminPermissions);
  }

  // Manager - gerenciamento de equipe e relatórios
  const managerRole = getRoleByName('manager');
  if (managerRole) {
    const managerPermissions = [
      'tickets:read', 'tickets:update', 'tickets:assign', 'tickets:close',
      'users:read', 'users:update',
      'reports:view', 'reports:export',
      'knowledge_base:read', 'knowledge_base:create', 'knowledge_base:update',
      'analytics:view', 'analytics:export'
    ];
    assignPermissionsToRole(managerRole.id, managerPermissions);
  }

  // Agent - atendimento de tickets
  const agentRole = getRoleByName('agent');
  if (agentRole) {
    const agentPermissions = [
      'tickets:read', 'tickets:update', 'tickets:close',
      'knowledge_base:read', 'knowledge_base:create',
      'users:read'
    ];
    assignPermissionsToRole(agentRole.id, agentPermissions);
  }

  // User - criação e acompanhamento de tickets
  const userRole = getRoleByName('user');
  if (userRole) {
    const userPermissions = [
      'tickets:create', 'tickets:read',
      'knowledge_base:read'
    ];
    assignPermissionsToRole(userRole.id, userPermissions);
  }

  // Read Only - apenas visualização
  const readOnlyRole = getRoleByName('read_only');
  if (readOnlyRole) {
    const readOnlyPermissions = [
      'tickets:read',
      'knowledge_base:read',
      'reports:view'
    ];
    assignPermissionsToRole(readOnlyRole.id, readOnlyPermissions);
  }

  // API Client - acesso programático
  const apiClientRole = getRoleByName('api_client');
  if (apiClientRole) {
    const apiClientPermissions = [
      'tickets:create', 'tickets:read', 'tickets:update',
      'users:read',
      'knowledge_base:read'
    ];
    assignPermissionsToRole(apiClientRole.id, apiClientPermissions);
  }
}

function assignPermissionsToRole(roleId: number, permissionNames: string[]): void {
  for (const permissionName of permissionNames) {
    const permission = getPermissionByName(permissionName);
    if (permission) {
      assignPermissionToRole(roleId, permission.id);
    }
  }
}

// ========================================
// FUNÇÕES DE EXPORTAÇÃO E UTILIDADES
// ========================================

/**
 * Export format for role permissions
 */
export interface RolePermissionsExport {
  role: Role;
  permissions: Array<{
    name: string;
    resource: string;
    action: string;
    conditions?: string;
  }>;
}

export function exportRolePermissions(roleId: number): RolePermissionsExport | null {
  try {
    const role = getRoleById(roleId);
    if (!role) return null;

    const permissions = getRolePermissions(roleId);

    return {
      role,
      permissions: permissions.map(p => ({
        name: p.name,
        resource: p.resource,
        action: p.action,
        conditions: p.conditions
      }))
    };
  } catch (error) {
    logger.error('Error exporting role permissions', error);
    return null;
  }
}

export function importRolePermissions(roleId: number, data: RolePermissionsExport): boolean {
  try {
    const { permissions } = data;
    const permissionIds: number[] = [];

    for (const permData of permissions) {
      const permission = getPermissionByName(permData.name);
      if (permission) {
        permissionIds.push(permission.id);
      }
    }

    return setRolePermissions(roleId, permissionIds);
  } catch (error) {
    logger.error('Error importing role permissions', error);
    return false;
  }
}

export function cloneRole(sourceRoleId: number, newRoleName: string, newDisplayName: string): Role | null {
  try {
    const sourceRole = getRoleById(sourceRoleId);
    if (!sourceRole) return null;

    const newRole = createRole({
      name: newRoleName,
      display_name: newDisplayName,
      description: `Cloned from ${sourceRole.display_name}`,
      is_system: false,
      is_active: true
    });

    if (!newRole) return null;

    const sourcePermissions = getRolePermissions(sourceRoleId);
    const permissionIds = sourcePermissions.map(p => p.id);

    setRolePermissions(newRole.id, permissionIds);

    return newRole;
  } catch (error) {
    logger.error('Error cloning role', error);
    return null;
  }
}

// ========================================
// MIDDLEWARE E DECORATORS PARA EXPRESS
// ========================================

/**
 * Extended request interface for authenticated requests
 */
export interface AuthenticatedRequest {
  user?: {
    id: number;
    [key: string]: unknown;
  };
  context?: PermissionContext;
  [key: string]: unknown;
}

/**
 * Response interface for middleware
 */
export interface MiddlewareResponse {
  status: (code: number) => MiddlewareResponse;
  json: (data: Record<string, unknown>) => unknown;
  [key: string]: unknown;
}

/**
 * Next function type
 */
export type NextFunction = () => void;

export function requirePermission(resource: string, action: string) {
  return (req: AuthenticatedRequest, res: MiddlewareResponse, next: NextFunction): void => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!hasPermission(userId, resource, action, req.context)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: `${resource}:${action}`
      });
      return;
    }

    next();
  };
}

export function requireRole(roleName: string) {
  return (req: AuthenticatedRequest, res: MiddlewareResponse, next: NextFunction): void => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!hasRole(userId, roleName)) {
      res.status(403).json({
        error: 'Insufficient role',
        required: roleName
      });
      return;
    }

    next();
  };
}

export function requireAnyRole(roleNames: string[]) {
  return (req: AuthenticatedRequest, res: MiddlewareResponse, next: NextFunction): void => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!hasAnyRole(userId, roleNames)) {
      res.status(403).json({
        error: 'Insufficient roles',
        required_any: roleNames
      });
      return;
    }

    next();
  };
}

// ========================================
// EXPORTS
// ========================================

// All functions are already exported with 'export function' declarations above
// No need to re-export them here