/**
 * Test Data Fixtures for E2E Tests
 * Contains reusable test data for various test scenarios
 */

export const testUsers = {
  admin: {
    email: 'admin@servicedesk.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
  },
  agent: {
    email: 'agent@servicedesk.com',
    password: 'agent123',
    name: 'Agent User',
    role: 'agent',
  },
  user: {
    email: 'user@servicedesk.com',
    password: 'user123',
    name: 'Regular User',
    role: 'user',
  },
  newUser: {
    email: `test.user.${Date.now()}@example.com`,
    password: 'Test123!@#',
    name: 'Test User',
    department: 'IT',
  },
};

export const testTickets = {
  basic: {
    title: 'Test Ticket - Basic Issue',
    description: 'This is a test ticket for automated testing',
    priority: 'medium',
    category: 'Hardware',
  },
  urgent: {
    title: 'Test Ticket - Urgent Issue',
    description: 'This is an urgent test ticket requiring immediate attention',
    priority: 'high',
    category: 'Network',
  },
  withDetails: {
    title: 'Test Ticket - Detailed Issue',
    description: 'This ticket contains detailed information about a complex issue that requires investigation and resolution',
    priority: 'low',
    category: 'Software',
    additionalInfo: 'Additional context and information',
  },
};

export const testComments = {
  basic: 'This is a test comment',
  detailed: 'This is a detailed test comment with more information about the issue',
  resolution: 'Issue has been resolved. Closing ticket.',
};

export const testCategories = {
  hardware: 'Hardware',
  software: 'Software',
  network: 'Network',
  access: 'Access',
};

export const testPriorities = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

export const testStatuses = {
  open: 'open',
  inProgress: 'in-progress',
  resolved: 'resolved',
  closed: 'closed',
};

export const generateUniqueEmail = () => {
  return `test.${Date.now()}.${Math.random().toString(36).substring(7)}@example.com`;
};

export const generateUniqueTicketTitle = () => {
  return `Test Ticket - ${Date.now()} - ${Math.random().toString(36).substring(7)}`;
};
