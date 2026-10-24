import { execSync } from 'node:child_process';
import * as path from 'node:path';
import { config } from 'dotenv';

config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) throw new Error('TEST_DATABASE_URL is required for e2e tests');

process.env.DATABASE_URL = testDbUrl;
process.env.MIGRATE_DATABASE_URL = testDbUrl;
process.env.NODE_ENV = 'test';

const API_DIR = path.join(__dirname, '..');

beforeAll(() => {
  const env = { ...process.env, DATABASE_URL: testDbUrl, MIGRATE_DATABASE_URL: testDbUrl };

  execSync('node ./scripts/create-test-db.js', { cwd: API_DIR, env, stdio: 'inherit' });
  execSync('pnpm prisma migrate deploy', { cwd: API_DIR, env, stdio: 'inherit' });
  execSync('node ./scripts/apply-rls.js', { cwd: API_DIR, env, stdio: 'inherit' });
  execSync('pnpm prisma db seed', { cwd: API_DIR, env, stdio: 'inherit' });
});