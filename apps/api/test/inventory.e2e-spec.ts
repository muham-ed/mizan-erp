// apps/api/test/inventory.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/test-app';

describe('Inventory Module (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const slugA = `inv-a-${Date.now()}`;
  const emailA = `inv-a-${Date.now()}@test.com`;
  const slugB = `inv-b-${Date.now()}`;
  const emailB = `inv-b-${Date.now()}@test.com`;
  const password = 'Str0ngPassw0rd';

  let tokenA = '';
  let tokenB = '';
  let categoryId = '';
  let productId = '';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    // Register Tenant A
    const resA = await request(app.getHttpServer())
      .post('/api/v1/auth/register-tenant')
      .send({ tenantName: 'Tenant A', slug: slugA, email: emailA, password, firstName: 'A', lastName: 'A' })
      .expect(201);
    tokenA = resA.body.accessToken;

    // Register Tenant B
    const resB = await request(app.getHttpServer())
      .post('/api/v1/auth/register-tenant')
      .send({ tenantName: 'Tenant B', slug: slugB, email: emailB, password, firstName: 'B', lastName: 'B' })
      .expect(201);
    tokenB = resB.body.accessToken;
  });

  afterAll(async () => {
    await prisma.asSuperAdmin(async (tx) => {
      await tx.stockMovement.deleteMany();
      await tx.stockLevel.deleteMany();
      await tx.product.deleteMany();
      await tx.category.deleteMany();
      await tx.user.deleteMany();
      await tx.tenant.deleteMany({ where: { slug: { in: [slugA, slugB] } } });
    });
    await app.close();
  });

  it('creates a category for Tenant A', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/categories')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Electronics', nameAr: 'إلكترونيات' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Electronics');
    categoryId = res.body.id;
  });

  it('creates a product for Tenant A', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        sku: 'LAPTOP-01',
        name: 'Dell Laptop',
        nameAr: 'لاب توب ديل',
        categoryId,
        costPrice: 15000,
        salePrice: 20000,
        taxRate: 14,
        reorderLevel: 5,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.sku).toBe('LAPTOP-01');
    productId = res.body.id;
  });

  it('prevents Tenant B from seeing Tenant A categories and products', async () => {
    const catRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/categories')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(catRes.body).toHaveLength(0);

    const prodRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(prodRes.body).toHaveLength(0);
  });

  it('records stock movement IN and updates stock balance', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock-movements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId,
        type: 'IN',
        quantity: 10,
        notes: 'Initial purchase batch',
      })
      .expect(201);

    const prodRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/products/${productId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(prodRes.body.stockLevels).toHaveLength(1);
    expect(Number(prodRes.body.stockLevels[0].quantity)).toBe(10);
  });

  it('records stock movement OUT and decreases stock balance', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/inventory/stock-movements')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId,
        type: 'OUT',
        quantity: 3,
        notes: 'Sales deduction',
      })
      .expect(201);

    const prodRes = await request(app.getHttpServer())
      .get(`/api/v1/inventory/products/${productId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(Number(prodRes.body.stockLevels[0].quantity)).toBe(7);
  });
});
