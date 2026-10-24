import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/test-app';

describe('Tenant Isolation (RLS)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantA: { id: string };
  let tenantB: { id: string };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    await prisma.asSuperAdmin(async (tx) => {
      await tx.stockMovement.deleteMany();
      await tx.stockLevel.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });

    const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { code: 'free' } });

    tenantA = await prisma.tenant.create({
      data: { name: 'Tenant A', slug: `a-${Date.now()}`, email: `a-${Date.now()}@test.com`, planId: plan.id, status: 'TRIAL' },
      select: { id: true },
    });
    tenantB = await prisma.tenant.create({
      data: { name: 'Tenant B', slug: `b-${Date.now()}`, email: `b-${Date.now()}@test.com`, planId: plan.id, status: 'TRIAL' },
      select: { id: true },
    });
  });

  afterAll(async () => {
    await prisma.asSuperAdmin(async (tx) => {
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });
    await app.close();
  });

  it('product created under tenant A is invisible to tenant B', async () => {
    const productA = await prisma.withTenant(tenantA.id, (tx) =>
      tx.product.create({
        data: { tenantId: tenantA.id, sku: 'SKU-A', name: 'A', costPrice: 10, salePrice: 20 },
        select: { id: true },
      }),
    );
    const asB = await prisma.withTenant(tenantB.id, (tx) => tx.product.findMany());
    expect(asB).toHaveLength(0);
    const asA = await prisma.withTenant(tenantA.id, (tx) => tx.product.findMany());
    expect(asA).toHaveLength(1);
    expect(asA[0].id).toBe(productA.id);
  });

  it('INSERT with the wrong tenantId is blocked by WITH CHECK', async () => {
    await expect(
      prisma.withTenant(tenantA.id, (tx) =>
        tx.product.create({
          data: { tenantId: tenantB.id, sku: 'SKU-X', name: 'X', costPrice: 1, salePrice: 1 },
        }),
      ),
    ).rejects.toThrow();
  });

  it('withTenant rejects SQL injection attempts in tenantId', async () => {
    await expect(
      prisma.withTenant("'; DROP TABLE users; --", async () => null),
    ).rejects.toThrow(/invalid tenantId/);
  });

  it('asSuperAdmin can see across tenants', async () => {
    await prisma.withTenant(tenantB.id, (tx) =>
      tx.product.create({
        data: { tenantId: tenantB.id, sku: 'SKU-B', name: 'B', costPrice: 1, salePrice: 2 },
      }),
    );
    const all = await prisma.asSuperAdmin((tx) => tx.product.findMany());
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('verifies asSuperAdmin context does NOT leak into subsequent withTenant calls on pooled connections', async () => {
    // 1. Run asSuperAdmin
    await prisma.asSuperAdmin(async (tx) => {
      const prods = await tx.product.findMany();
      expect(prods.length).toBeGreaterThanOrEqual(2);
    });

    // 2. Immediately run withTenant for Tenant A on same instance
    const asA = await prisma.withTenant(tenantA.id, async (tx) => {
      // Check session variable inside Postgres
      const [{ is_admin }] = await tx.$queryRawUnsafe<{ is_admin: string }[]>(
        `SELECT COALESCE(current_setting('app.is_super_admin', true), '') AS is_admin;`,
      );
      expect(is_admin).not.toBe('true');

      // Verify RLS is actively filtering tenant A's scope only
      return tx.product.findMany();
    });

    expect(asA.length).toBe(1);
    expect(asA[0].tenantId).toBe(tenantA.id);
  });
});
