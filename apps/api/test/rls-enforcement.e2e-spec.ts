import { PrismaClient } from '@prisma/client';

describe('RLS is ACTUALLY enforced', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('app DB user is NOT a superuser and NOT BYPASSRLS', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>>(
      `SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].rolsuper).toBe(false);
    expect(rows[0].rolbypassrls).toBe(false);
  });

  it('rls_status shows enabled + policy per tenant-scoped table', async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string; rls_enabled: boolean; policy_count: number }>>(
      `SELECT * FROM rls_status ORDER BY tablename`,
    );
    expect(rows.length).toBe(9);
    for (const r of rows) {
      expect(r.rls_enabled).toBe(true);
      expect(Number(r.policy_count)).toBeGreaterThanOrEqual(1);
    }
  });
});