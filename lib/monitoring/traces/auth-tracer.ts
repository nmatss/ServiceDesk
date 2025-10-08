/**
 * Traces customizados para operações de autenticação
 */

import { ddTracer, SpanAttributes } from '../datadog-tracer';
import { logger } from '../logger';

/**
 * Trace de login de usuário
 */
export async function traceLogin(
  email: string,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'auth.login',
    async (span) => {
      span.setAttribute('auth.email', email);
      span.setAttribute('auth.method', 'credentials');
      span.setAttribute('resource.name', 'POST /api/auth/login');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('auth.success', true);
        span.setAttribute('auth.user_id', result?.id);
        span.setAttribute('auth.role', result?.role);
        span.setAttribute('auth.organization_id', result?.organization_id);
        span.setAttribute('duration_ms', duration);

        logger.auth('User login successful', result?.id, {
          email,
          role: result?.role,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('auth.success', false);
        span.setAttribute('auth.failure_reason', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.security('User login failed', {
          email,
          error: (error as Error).message,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de registro de usuário
 */
export async function traceRegister(
  email: string,
  role: string,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'auth.register',
    async (span) => {
      span.setAttribute('auth.email', email);
      span.setAttribute('auth.role', role);
      span.setAttribute('auth.method', 'credentials');
      span.setAttribute('resource.name', 'POST /api/auth/register');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('auth.success', true);
        span.setAttribute('auth.user_id', result?.id);
        span.setAttribute('duration_ms', duration);

        logger.auth('User registration successful', result?.id, {
          email,
          role,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('auth.success', false);
        span.setAttribute('auth.failure_reason', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.security('User registration failed', {
          email,
          role,
          error: (error as Error).message,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de verificação de token JWT
 */
export async function traceVerifyToken(
  token: string,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'auth.verify_token',
    async (span) => {
      span.setAttribute('auth.method', 'jwt');
      span.setAttribute('resource.name', 'JWT Verification');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('auth.success', true);
        span.setAttribute('auth.user_id', result?.id);
        span.setAttribute('auth.role', result?.role);
        span.setAttribute('auth.organization_id', result?.organization_id);
        span.setAttribute('duration_ms', duration);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('auth.success', false);
        span.setAttribute('auth.failure_reason', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.security('Token verification failed', {
          error: (error as Error).message,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de hash de senha
 */
export async function traceHashPassword(
  fn: () => Promise<string>
): Promise<string> {
  return await ddTracer.trace(
    'auth.hash_password',
    async (span) => {
      span.setAttribute('auth.operation', 'password_hash');
      span.setAttribute('resource.name', 'bcrypt.hash');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('security.hashing_complete', true);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('security.hashing_complete', false);

        throw error;
      }
    }
  );
}

/**
 * Trace de verificação de senha
 */
export async function traceVerifyPassword(
  fn: () => Promise<boolean>
): Promise<boolean> {
  return await ddTracer.trace(
    'auth.verify_password',
    async (span) => {
      span.setAttribute('auth.operation', 'password_verification');
      span.setAttribute('resource.name', 'bcrypt.compare');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('auth.password_match', result);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);

        throw error;
      }
    }
  );
}

/**
 * Trace de geração de token JWT
 */
export async function traceGenerateToken(
  userId: number,
  fn: () => Promise<string>
): Promise<string> {
  return await ddTracer.trace(
    'auth.generate_token',
    async (span) => {
      span.setAttribute('auth.operation', 'token_generation');
      span.setAttribute('auth.user_id', userId);
      span.setAttribute('resource.name', 'JWT Generation');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('auth.token_generated', true);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('duration_ms', duration);
        span.setAttribute('auth.token_generated', false);

        throw error;
      }
    }
  );
}

/**
 * Trace de SSO (Single Sign-On)
 */
export async function traceSSOAuthentication(
  provider: string,
  fn: () => Promise<any>
): Promise<any> {
  return await ddTracer.trace(
    'auth.sso',
    async (span) => {
      span.setAttribute('auth.method', 'sso');
      span.setAttribute('auth.provider', provider);
      span.setAttribute('resource.name', `SSO Authentication - ${provider}`);

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('auth.success', true);
        span.setAttribute('auth.user_id', result?.id);
        span.setAttribute('duration_ms', duration);

        logger.auth('SSO authentication successful', result?.id, {
          provider,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('auth.success', false);
        span.setAttribute('auth.failure_reason', (error as Error).message);
        span.setAttribute('duration_ms', duration);

        logger.security('SSO authentication failed', {
          provider,
          error: (error as Error).message,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}

/**
 * Trace de MFA (Multi-Factor Authentication)
 */
export async function traceMFAVerification(
  userId: number,
  method: string,
  fn: () => Promise<boolean>
): Promise<boolean> {
  return await ddTracer.trace(
    'auth.mfa_verification',
    async (span) => {
      span.setAttribute('auth.method', 'mfa');
      span.setAttribute('auth.mfa_method', method);
      span.setAttribute('auth.user_id', userId);
      span.setAttribute('resource.name', 'MFA Verification');

      const startTime = Date.now();

      try {
        const result = await fn();

        const duration = Date.now() - startTime;
        span.setAttribute('auth.mfa_success', result);
        span.setAttribute('duration_ms', duration);

        logger.auth('MFA verification attempt', userId, {
          method,
          success: result,
          duration_ms: duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        span.setAttribute('auth.mfa_success', false);
        span.setAttribute('duration_ms', duration);

        logger.security('MFA verification failed', {
          user_id: userId,
          method,
          error: (error as Error).message,
          duration_ms: duration,
        });

        throw error;
      }
    }
  );
}
