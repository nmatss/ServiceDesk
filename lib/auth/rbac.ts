import { executeQuery, executeQueryOne, executeRun, executeTransaction, type DatabaseAdapter } from '../db/adapter';
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

export async function createPermission(permissionData: CreatePermission): Promise<Permission | null> {
  try {
    const result = await executeRun(`
      INSERT INTO permissions (name, description, resource, action, conditions)
      VALUES (?, ?, ?, ?, ?)
    `, [
      permissionData.name,
      permissionData.description,
      permissionData.resource,
      permissionData.action,
      permissionData.conditions
    ]);

    if (result.lastInsertRowid) {
      return await getPermissionById(result.lastInsertRowid);
    }
    return null;
  } catch (error) {
    logger.error('Error creating permission', error);
    return null;
  }
}

export async function getPermissionById(id: number): Promise<Permission | null> {
  try {
    const result = await executeQueryOne<Permission>('SELECT * FROM permissions WHERE id = ?', [id]);
    return result || null;
  } catch (error) {
    logger.error('Error getting permission by ID', error);
    return null;
  }
}

export async function getPermissionByName(name: string): Promise<Permission | null> {
  try {
    const result = await executeQueryOne<Permission>('SELECT * FROM permissions WHERE name = ?', [name]);
    return result || null;
  } catch (error) {
    logger.error('Error getting permission by name', error);
    return null;
  }
}

export async function getAllPermissions(): Promise<Permission[]> {
  try {
    return await executeQuery<Permission>('SELECT * FROM permissions ORDER BY resource, action', []);
  } catch (error) {
    logger.error('Error getting all permissions', error);
    return [];
  }
}

export async function getPermissionsByResource(resource: string): Promise<Permission[]> {
  try {
    return await executeQuery<Permission>('SELECT * FROM permissions WHERE resource = ? ORDER BY action', [resource]);
  } catch (error) {
    logger.error('Error getting permissions by resource', error);
    return [];
  }
}

export async function deletePermission(id: number): Promise<boolean> {
  try {
    const result = await executeRun('DELETE FROM permissions WHERE id = ?', [id]);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error deleting permission', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE PAPÉIS (ROLES)
// ========================================

export async function createRole(roleData: CreateRole): Promise<Role | null> {
  try {
    const result = await executeRun(`
      INSERT INTO roles (name, display_name, description, is_system, is_active)
      VALUES (?, ?, ?, ?, ?)
    `, [
      roleData.name,
      roleData.display_name,
      roleData.description,
      roleData.is_system ? 1 : 0,
      roleData.is_active ? 1 : 0
    ]);

    if (result.lastInsertRowid) {
      return await getRoleById(result.lastInsertRowid);
    }
    return null;
  } catch (error) {
    logger.error('Error creating role', error);
    return null;
  }
}

export async function getRoleById(id: number): Promise<Role | null> {
  try {
    const result = await executeQueryOne<Role>('SELECT * FROM roles WHERE id = ?', [id]);
    return result || null;
  } catch (error) {
    logger.error('Error getting role by ID', error);
    return null;
  }
}

export async function getRoleByName(name: string): Promise<Role | null> {
  try {
    const result = await executeQueryOne<Role>('SELECT * FROM roles WHERE name = ?', [name]);
    return result || null;
  } catch (error) {
    logger.error('Error getting role by name', error);
    return null;
  }
}

export async function getAllRoles(): Promise<Role[]> {
  try {
    return await executeQuery<Role>('SELECT * FROM roles WHERE is_active = 1 ORDER BY display_name', []);
  } catch (error) {
    logger.error('Error getting all roles', error);
    return [];
  }
}

export async function updateRole(id: number, updates: Partial<Omit<Role, 'id' | 'created_at'>>): Promise<boolean> {
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

    const result = await executeRun(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, values);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error updating role', error);
    return false;
  }
}

export async function deleteRole(id: number): Promise<boolean> {
  try {
    // Não permitir deletar papéis do sistema
    const role = await getRoleById(id);
    if (!role || role.is_system) {
      return false;
    }

    const result = await executeRun('DELETE FROM roles WHERE id = ?', [id]);
    return result.changes > 0;
  } catch (error) {
    logger.error('Error deleting role', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE RELACIONAMENTO ROLE-PERMISSION
// ========================================

export async function assignPermissionToRole(roleId: number, permissionId: number, grantedBy?: number): Promise<boolean> {
  try {
    const result = await executeRun(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted_by)
      VALUES (?, ?, ?)
    `, [roleId, permissionId, grantedBy]);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error assigning permission to role', error);
    return false;
  }
}

export async function removePermissionFromRole(roleId: number, permissionId: number): Promise<boolean> {
  try {
    const result = await executeRun(`
      DELETE FROM role_permissions
      WHERE role_id = ? AND permission_id = ?
    `, [roleId, permissionId]);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error removing permission from role', error);
    return false;
  }
}

export async function getRolePermissions(roleId: number): Promise<Permission[]> {
  try {
    return await executeQuery<Permission>(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.resource, p.action
    `, [roleId]);
  } catch (error) {
    logger.error('Error getting role permissions', error);
    return [];
  }
}

export async function setRolePermissions(roleId: number, permissionIds: number[], grantedBy?: number): Promise<boolean> {
  try {
    await executeTransaction(async (db) => {
      // Remover todas as permissões existentes
      await db.run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

      // Adicionar novas permissões
      for (const permissionId of permissionIds) {
        await db.run(`
          INSERT INTO role_permissions (role_id, permission_id, granted_by)
          VALUES (?, ?, ?)
        `, [roleId, permissionId, grantedBy]);
      }
    });

    return true;
  } catch (error) {
    logger.error('Error setting role permissions', error);
    return false;
  }
}

// ========================================
// FUNÇÕES DE RELACIONAMENTO USER-ROLE
// ========================================

export async function assignRoleToUser(
  userId: number,
  roleId: number,
  grantedBy?: number,
  expiresAt?: string
): Promise<boolean> {
  try {
    const result = await executeRun(`
      INSERT OR REPLACE INTO user_roles (user_id, role_id, granted_by, expires_at, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [userId, roleId, grantedBy, expiresAt]);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error assigning role to user', error);
    return false;
  }
}

export async function removeRoleFromUser(userId: number, roleId: number): Promise<boolean> {
  try {
    const result = await executeRun(`
      UPDATE user_roles
      SET is_active = 0
      WHERE user_id = ? AND role_id = ?
    `, [userId, roleId]);

    return result.changes > 0;
  } catch (error) {
    logger.error('Error removing role from user', error);
    return false;
  }
}

export async function getUserRoles(userId: number): Promise<Role[]> {
  try {
    return await executeQuery<Role>(`
      SELECT r.* FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
        AND ur.is_active = 1
        AND r.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
      ORDER BY r.display_name
    `, [userId]);
  } catch (error) {
    logger.error('Error getting user roles', error);
    return [];
  }
}

export async function getUserPermissions(userId: number): Promise<Permission[]> {
  try {
    return await executeQuery<Permission>(`
      SELECT DISTINCT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = ?
        AND ur.is_active = 1
        AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
      ORDER BY p.resource, p.action
    `, [userId]);
  } catch (error) {
    logger.error('Error getting user permissions', error);
    return [];
  }
}

export async function setUserRoles(userId: number, roleIds: number[], grantedBy?: number): Promise<boolean> {
  try {
    await executeTransaction(async (db) => {
      // Desativar todas as roles existentes
      await db.run('UPDATE user_roles SET is_active = 0 WHERE user_id = ?', [userId]);

      // Adicionar novas roles
      for (const roleId of roleIds) {
        await db.run(`
          INSERT OR REPLACE INTO user_roles (user_id, role_id, granted_by, is_active)
          VALUES (?, ?, ?, 1)
        `, [userId, roleId, grantedBy]);
      }
    });

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

export async function hasPermission(
  userId: number,
  resource: string,
  action: string,
  context?: PermissionContext
): Promise<boolean> {
  try {
    const permissions = await getUserPermissions(userId);

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

export async function hasRole(userId: number, roleName: string): Promise<boolean> {
  try {
    const roles = await getUserRoles(userId);
    return roles.some(role => role.name === roleName);
  } catch (error) {
    logger.error('Error checking role', error);
    return false;
  }
}

export async function hasAnyRole(userId: number, roleNames: string[]): Promise<boolean> {
  try {
    const roles = await getUserRoles(userId);
    const userRoleNames = roles.map(role => role.name);
    return roleNames.some(roleName => userRoleNames.includes(roleName));
  } catch (error) {
    logger.error('Error checking any role', error);
    return false;
  }
}

export async function hasAllRoles(userId: number, roleNames: string[]): Promise<boolean> {
  try {
    const roles = await getUserRoles(userId);
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

export async function initializeDefaultRolesAndPermissions(): Promise<boolean> {
  try {
    await executeTransaction(async (db) => {
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
      for (const permission of defaultPermissions) {
        await db.run(`
          INSERT OR IGNORE INTO permissions (name, description, resource, action)
          VALUES (?, ?, ?, ?)
        `, [
          permission.name,
          permission.description,
          permission.resource,
          permission.action
        ]);
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
      for (const role of defaultRoles) {
        await db.run(`
          INSERT OR IGNORE INTO roles (name, display_name, description, is_system, is_active)
          VALUES (?, ?, ?, ?, ?)
        `, [
          role.name,
          role.display_name,
          role.description,
          role.is_system ? 1 : 0,
          role.is_active ? 1 : 0
        ]);
      }

      // Atribuir permissões aos papéis
      await setupDefaultRolePermissions(db);
    });

    return true;
  } catch (error) {
    logger.error('Error initializing roles and permissions', error);
    return false;
  }
}

async function setupDefaultRolePermissions(db: DatabaseAdapter): Promise<void> {
  // Admin - todas as permissões
  const adminRole = await db.get<Role>('SELECT * FROM roles WHERE name = ?', ['admin']);
  if (adminRole) {
    const adminPermissions = ['admin:manage'];
    await assignPermissionsToRoleWithDb(db, adminRole.id, adminPermissions);
  }

  // Manager - gerenciamento de equipe e relatórios
  const managerRole = await db.get<Role>('SELECT * FROM roles WHERE name = ?', ['manager']);
  if (managerRole) {
    const managerPermissions = [
      'tickets:read', 'tickets:update', 'tickets:assign', 'tickets:close',
      'users:read', 'users:update',
      'reports:view', 'reports:export',
      'knowledge_base:read', 'knowledge_base:create', 'knowledge_base:update',
      'analytics:view', 'analytics:export'
    ];
    await assignPermissionsToRoleWithDb(db, managerRole.id, managerPermissions);
  }

  // Agent - atendimento de tickets
  const agentRole = await db.get<Role>('SELECT * FROM roles WHERE name = ?', ['agent']);
  if (agentRole) {
    const agentPermissions = [
      'tickets:read', 'tickets:update', 'tickets:close',
      'knowledge_base:read', 'knowledge_base:create',
      'users:read'
    ];
    await assignPermissionsToRoleWithDb(db, agentRole.id, agentPermissions);
  }

  // User - criação e acompanhamento de tickets
  const userRole = await db.get<Role>('SELECT * FROM roles WHERE name = ?', ['user']);
  if (userRole) {
    const userPermissions = [
      'tickets:create', 'tickets:read',
      'knowledge_base:read'
    ];
    await assignPermissionsToRoleWithDb(db, userRole.id, userPermissions);
  }

  // Read Only - apenas visualização
  const readOnlyRole = await db.get<Role>('SELECT * FROM roles WHERE name = ?', ['read_only']);
  if (readOnlyRole) {
    const readOnlyPermissions = [
      'tickets:read',
      'knowledge_base:read',
      'reports:view'
    ];
    await assignPermissionsToRoleWithDb(db, readOnlyRole.id, readOnlyPermissions);
  }

  // API Client - acesso programático
  const apiClientRole = await db.get<Role>('SELECT * FROM roles WHERE name = ?', ['api_client']);
  if (apiClientRole) {
    const apiClientPermissions = [
      'tickets:create', 'tickets:read', 'tickets:update',
      'users:read',
      'knowledge_base:read'
    ];
    await assignPermissionsToRoleWithDb(db, apiClientRole.id, apiClientPermissions);
  }
}

async function assignPermissionsToRoleWithDb(db: DatabaseAdapter, roleId: number, permissionNames: string[]): Promise<void> {
  for (const permissionName of permissionNames) {
    const permission = await db.get<Permission>('SELECT * FROM permissions WHERE name = ?', [permissionName]);
    if (permission) {
      await db.run(`
        INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted_by)
        VALUES (?, ?, ?)
      `, [roleId, permission.id, undefined]);
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

export async function exportRolePermissions(roleId: number): Promise<RolePermissionsExport | null> {
  try {
    const role = await getRoleById(roleId);
    if (!role) return null;

    const permissions = await getRolePermissions(roleId);

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

export async function importRolePermissions(roleId: number, data: RolePermissionsExport): Promise<boolean> {
  try {
    const { permissions } = data;
    const permissionIds: number[] = [];

    for (const permData of permissions) {
      const permission = await getPermissionByName(permData.name);
      if (permission) {
        permissionIds.push(permission.id);
      }
    }

    return await setRolePermissions(roleId, permissionIds);
  } catch (error) {
    logger.error('Error importing role permissions', error);
    return false;
  }
}

export async function cloneRole(sourceRoleId: number, newRoleName: string, newDisplayName: string): Promise<Role | null> {
  try {
    const sourceRole = await getRoleById(sourceRoleId);
    if (!sourceRole) return null;

    const newRole = await createRole({
      name: newRoleName,
      display_name: newDisplayName,
      description: `Cloned from ${sourceRole.display_name}`,
      is_system: false,
      is_active: true
    });

    if (!newRole) return null;

    const sourcePermissions = await getRolePermissions(sourceRoleId);
    const permissionIds = sourcePermissions.map(p => p.id);

    await setRolePermissions(newRole.id, permissionIds);

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
  return async (req: AuthenticatedRequest, res: MiddlewareResponse, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!(await hasPermission(userId, resource, action, req.context))) {
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
  return async (req: AuthenticatedRequest, res: MiddlewareResponse, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!(await hasRole(userId, roleName))) {
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
  return async (req: AuthenticatedRequest, res: MiddlewareResponse, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!(await hasAnyRole(userId, roleNames))) {
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