import { vi } from 'vitest';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.RESEND_API_KEY = 'test-key';
process.env.FROM_EMAIL = 'test@example.com';
process.env.APP_URL = 'http://localhost:3000';
process.env.SUPPORT_EMAIL = 'support@example.com';
process.env.SUPPORT_PHONE = '+1234567890';

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

// Mock the database client
vi.mock('../src/db/client', () => ({
  db: {},
}));

// Mock the database index
vi.mock('../src/db/index', () => ({
  db: {},
}));

// Mock the database schema imports
vi.mock('../src/db/schema/loanApplications', () => ({
  loanApplications: {},
}));

vi.mock('../src/db/schema/users', () => ({
  users: {},
}));

vi.mock('../src/db/schema/applicationAuditTrail', () => ({
  applicationAuditTrail: {},
}));
