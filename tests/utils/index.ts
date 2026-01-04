/**
 * Test Utilities - Central Export
 * Exports all testing utilities for easy import in test files
 */

// Database mocking utilities
export {
  createInMemoryDatabase,
  createTempDatabase,
  initializeTestSchema,
  seedReferenceData,
  createMockUser,
  createMockTicket,
  createMockComment,
  createMockArticle,
  clearTestData,
  getRecordCount,
  setupTestDatabase,
  cleanupTestDatabase,
  type MockDatabase,
} from './mockDatabase'

// Authentication mocking utilities
export {
  createMockUser as createAuthMockUser,
  createMockAdmin,
  createMockAgent,
  createMockToken,
  createAdminToken,
  createAgentToken,
  createAuthHeaders,
  createAuthenticatedRequest,
  createAdminRequest,
  createAgentRequest,
  createMockRequest,
  createMockResponse,
  mockNextResponse,
  extractUserFromAuth,
  getTestCredentials,
  mockHashPassword,
  setupAuthContext,
  verifyMockToken,
  type MockUser,
  type MockCredentials,
  type MockAuthContext,
} from './mockAuth'

// General test helpers
export {
  sleep,
  waitFor,
  withTimeout,
  retry,
  createMockFn,
  randomData,
  assertSchema,
  assertApiSuccess,
  assertApiError,
  expectToThrow,
  testDate,
  formatDbDate,
  parseDbDate,
  deepClone,
  compareObjectsIgnoring,
  env,
  fs,
  ConsoleCapture,
  PerformanceTimer,
  createTimer,
  type MockFn,
  type ApiResponse,
} from './testHelpers'
