// apps/api/test/auth.e2e-spec.ts
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
      await tx.tenant.deleteMany({ where: { slug } });
    });
    await app.close();
  });

  let accessToken = '';
  let refreshUserId = '';
  let refreshJti = '';

  it('registers a tenant + admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'Acme',
        slug,
        email,
        password,
        firstName: 'Owner',
        lastName: 'One',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.role).toBe('ADMIN');
    accessToken = res.body.accessToken;
  });

  it('logs in and returns a token pair', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    refreshUserId = extractSub(res.body.refreshToken);
    refreshJti = extractJti(res.body.refreshToken);
  });

  it('rejects a weak password at registration', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register-tenant')
      .send({
        tenantName: 'X', slug: `x-${Date.now()}`, email: `x-${Date.now()}@x.com`,
        password: 'weak', firstName: 'a', lastName: 'b',
      })
      .expect(400);
  });

  it('rejects /me without a token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('accepts /me with a valid token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.email).toBe(email);
  });

  it('rotates the refresh token and rejects the old one', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ userId: refreshUserId, jti: refreshJti })
      .expect(201);
    expect(first.body.accessToken).toBeDefined();

    // Same jti must now be invalid.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ userId: refreshUserId, jti: refreshJti })
      .expect(401);
  });
});

function decode(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}
function extractSub(token: string): string {
  return decode(token).sub as string;
}
function extractJti(token: string): string {
  return decode(token).jti as string;
}
