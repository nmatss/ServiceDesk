/**
 * Auth service abstraction for production routes.
 *
 * Temporary compatibility layer: currently delegates to sqlite-auth exports,
 * allowing route imports to stop depending directly on sqlite-auth.
 */

export {
  authenticateUser,
  createUser,
  deleteUser,
  emailExists,
  generateToken,
  getAllUsers,
  getOrganizationById,
  getUserByEmail,
  getUserById,
  hashPassword,
  updateUser,
  updateUserPassword,
  verifyAuth,
  verifyAuthToken,
  verifyPassword,
  verifyToken,
  verifyTokenFromCookies,
} from './sqlite-auth';

export type {
  AuthUser,
  LoginCredentials,
  RegisterData,
} from './sqlite-auth';
