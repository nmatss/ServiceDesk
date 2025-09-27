import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import db from '../db/connection';
import { User } from '../types/database';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'agent' | 'user';
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'agent' | 'user';
  created_at: string;
  updated_at: string;
}

/**
 * Hash de senha usando bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

/**
 * Verifica se a senha está correta
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword);
}

/**
 * Busca usuário por email
 */
export function getUserByEmail(email: string): User | null {
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User;
    return user || null;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
}

/**
 * Busca usuário por ID
 */
export function getUserById(id: number): User | null {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User;
    return user || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

/**
 * Cria um novo usuário
 */
export async function createUser(userData: RegisterData): Promise<User | null> {
  try {
    const hashedPassword = await hashPassword(userData.password);
    
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role) 
      VALUES (?, ?, ?, ?)
    `);
    
    const result = insertUser.run(
      userData.name,
      userData.email,
      hashedPassword,
      userData.role || 'user'
    );
    
    const newUser = getUserById(result.lastInsertRowid as number);
    return newUser;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

/**
 * Autentica usuário com email e senha
 */
export async function authenticateUser(credentials: LoginCredentials): Promise<AuthUser | null> {
  try {
    const user = getUserByEmail(credentials.email);
    if (!user) {
      return null;
    }

    // Verificar se o usuário tem senha hash (usuários antigos podem não ter)
    if (!user.password_hash) {
      return null;
    }

    const isValidPassword = await verifyPassword(credentials.password, user.password_hash);
    if (!isValidPassword) {
      return null;
    }

    // Retornar dados do usuário sem a senha
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}

/**
 * Atualiza senha do usuário
 */
export async function updateUserPassword(userId: number, newPassword: string): Promise<boolean> {
  try {
    const hashedPassword = await hashPassword(newPassword);
    
    const updatePassword = db.prepare(`
      UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    const result = updatePassword.run(hashedPassword, userId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error updating password:', error);
    return false;
  }
}

/**
 * Verifica se email já existe
 */
export function emailExists(email: string): boolean {
  try {
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    return !!user;
  } catch (error) {
    console.error('Error checking email existence:', error);
    return false;
  }
}

/**
 * Lista todos os usuários (para admin)
 */
export function getAllUsers(): User[] {
  try {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
    return users;
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
}

/**
 * Atualiza dados do usuário
 */
export function updateUser(userId: number, updates: Partial<Pick<User, 'name' | 'email' | 'role'>>): boolean {
  try {
    const fields = [];
    const values = [];
    
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    
    if (fields.length === 0) {
      return false;
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    
    const updateUser = db.prepare(`
      UPDATE users SET ${fields.join(', ')} WHERE id = ?
    `);
    
    const result = updateUser.run(...values);
    return result.changes > 0;
  } catch (error) {
    console.error('Error updating user:', error);
    return false;
  }
}

/**
 * Deleta usuário
 */
export function deleteUser(userId: number): boolean {
  try {
    const deleteUser = db.prepare('DELETE FROM users WHERE id = ?');
    const result = deleteUser.run(userId);
    return result.changes > 0;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

/**
 * Gera token JWT
 */
export async function generateToken(user: AuthUser): Promise<string> {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key');
  
  const token = await new SignJWT({ 
    id: user.id, 
    email: user.email, 
    role: user.role 
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
    
  return token;
}

/**
 * Verifica token JWT
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key-for-jwt-development-only');
    
    const { payload } = await jwtVerify(token, secret);
    
    if (!payload.id || !payload.email || !payload.role) {
      return null;
    }
    
    // Buscar usuário no banco para garantir que ainda existe
    const user = getUserById(payload.id as number);
    if (!user) {
      return null;
    }
    
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

