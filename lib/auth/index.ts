/**
 * Authentication Module
 * NextAuth configuration and authentication helpers
 */

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyPassword, getUserByEmail } from './sqlite-auth';
import { logger } from '../monitoring/logger';

/**
 * NextAuth Configuration
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        try {
          const user = await getUserByEmail(credentials.email);

          if (!user) {
            throw new Error('Invalid email or password');
          }

          const isValid = await verifyPassword(credentials.password, user.password);

          if (!isValid) {
            throw new Error('Invalid email or password');
          }

          return {
            id: String(user.id),
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          logger.error('Authentication error', error);
          return null;
        }
      }
    })
  ],
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production',
  debug: process.env.NODE_ENV === 'development',
};

/**
 * Re-export auth utilities
 */
export * from './sqlite-auth';
export * from './rbac-engine';

/**
 * Enterprise Auth Modules
 */
export { ssoManager } from './sso-manager';
export { mfaManager } from './mfa-manager';
export { rbac } from './rbac-engine';

// Export types
export type { SSOProvider, SSOConfiguration, SSOUser } from './sso-manager';
export type { MFASetup, MFAVerification, MFADevice } from './mfa-manager';
export type { PermissionCheck, ResourcePermission, RowLevelPolicy, AuditEntry } from './rbac-engine';
