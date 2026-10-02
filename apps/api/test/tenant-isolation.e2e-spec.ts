// apps/api/test/tenant-isolation.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

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

    // Clean slate
    await prisma.asSuperAdmin(async (tx) => {
      await tx.stockMovement.deleteMany();
      await tx.stockLevel.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });

    const plan = await prisma.subscriptionPlan.findFirstOrThrow({ where: { code: 'free' } });

    const a = await prisma.tenant.create({
      data: {
        name: 'Tenant A', slug: 'tenant-a', email: 'a@test.com',
        planId: plan.id, status: 'TRIAL',
      },
      select: { id: true },
    });
    const b = await prisma.tenant.create({
      data: {
        name: 'Tenant B', slug: 'tenant-b', email: 'b@test.com',
        planId: plan.id, status: 'TRIAL',
      },
      select: { id: true },
    });
    tenantA = a;
    tenantB = b;
  });

  afterAll(async () => {
    await prisma.asSuperAdmin(async (tx) => {
      await tx.user.deleteMany();
      await tx.tenant.deleteMany();
    });
    await app.close();
  });

  it('inserts a product under tenant A and cannot see it under tenant B', async () => {
    // Insert as A
    const productA = await prisma.withTenant(tenantA.id, async (tx) =>
      tx.product.create({
        data: {
          tenantId: tenantA.id,
          sku: 'SKU-A-1',
          name: 'Product A',
          costPrice: 10,
          salePrice: 20,
        },
        select: { id: true, sku: true },
      }),
    );
    expect(productA.sku).toBe('SKU-A-1');

    // Query as B — MUST be empty
    const asB = await prisma.withTenant(tenantB.id, async (tx) =>
      tx.product.findMany(),
    );
    expect(asB).toHaveLength(0);

    // Query as A — must find it
    const asA = await prisma.withTenant(tenantA.id, async (tx) =>
      tx.product.findMany(),
    );
    expect(asA).toHaveLength(1);
    expect(asA[0].id).toBe(productA.id);
  });

  it('rejects an INSERT with the wrong tenantId', async () => {
    await expect(
      prisma.withTenant(tenantA.id, async (tx) =>
        tx.product.create({
          data: {
            tenantId: tenantB.id, // WRONG — should be blocked by RLS WITH CHECK
            sku: 'SKU-X',
            name: 'Cross-tenant insert',
            costPrice: 1,
            salePrice: 1,
          },
        }),
      ),
    ).rejects.toThrow();
  });

  it('withTenant rejects an invalid tenantId', async () => {
    await expect(
      prisma.withTenant("'; DROP TABLE users; --", async () => null),
    ).rejects.toThrow(/invalid tenantId/);
  });

  it('asSuperAdmin can see across tenants', async () => {
    await prisma.withTenant(tenantB.id, async (tx) =>
      tx.product.create({
        data: {
          tenantId: tenantB.id,
          sku: 'SKU-B-1',
          name: 'Product B',
          costPrice: 1,
          salePrice: 2,
        },
      }),
    );

    const all = await prisma.asSuperAdmin(async (tx) => tx.product.findMany());
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
