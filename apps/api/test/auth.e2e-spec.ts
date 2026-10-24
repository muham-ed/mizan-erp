import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/test-app';

describe('Auth flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const slug = `acme-${Date.now()}`;
  const email = `owner-${Date.now()}@acme.test`;
  const password = 'Str0ngPassw0rd';

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.asSuperAdmin(async (tx) => {
      await tx.user.deleteMany({ where: { email } });
      await tx.tenant.deleteMany({ where: { slug: { startsWith: slug } } });
    });
    await app.close();
  });

  let accessToken = '';
  let refreshUserId = '';
  let refreshJti = '';

  it('registers a tenant + admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register-tenant')
      .send({ tenantName: 'Acme', slug, email, password, firstName: 'O', lastName: 'One' })
      .expect(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('ADMIN');
    accessToken = res.body.accessToken;
  });

  it('logs in with tenantSlug + email + password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ tenantSlug: slug, email, password })
      .expect(201);
    refreshUserId = extractSub(res.body.refreshToken);
    refreshJti = extractJti(res.body.refreshToken);
  });

  it('rejects weak password at registration with a password-specific error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'X Corp', slug: `x-${Date.now()}`,
        email: `x-${Date.now()}@x.com`, password: 'weak',
        firstName: 'A', lastName: 'B',
      })
      .expect(400);
    expect(JSON.stringify(res.body)).toMatch(/password|least 10/i);
  });

  it('rejects /me without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('accepts /me with valid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(email);
  });

  it('rotates refresh token and rejects the old one', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ userId: refreshUserId, jti: refreshJti })
      .expect(201);
    expect(first.body.accessToken).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ userId: refreshUserId, jti: refreshJti })
      .expect(401);
  });

  it('rejects login with wrong tenantSlug even with valid credentials', async () => {
    const otherSlug = `${slug}-other`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Other', slug: otherSlug,
        email, password, firstName: 'O', lastName: 'Two',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ tenantSlug: otherSlug, email, password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ tenantSlug: slug, email, password })
      .expect(201);
  });
});

function decode(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}
function extractSub(token: string): string { return decode(token).sub as string; }
function extractJti(token: string): string { return decode(token).jti as string; }