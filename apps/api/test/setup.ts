// apps/api/test/setup.ts
import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) throw new Error('TEST_DATABASE_URL is required for e2e tests');

// Override DATABASE_URL for the app under test.
process.env.DATABASE_URL = testDbUrl;
process.env.NODE_ENV = 'test';

// Push schema + apply RLS. Fast enough for CI, safe because it's a test DB.
beforeAll(() => {
  execSync('pnpm prisma migrate deploy', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
  });
  execSync('node ./scripts/apply-rls.js', {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: testDbUrl },
    stdio: 'inherit',
  });
});
