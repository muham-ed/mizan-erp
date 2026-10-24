import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { LoginDto, RefreshDto, RegisterTenantDto } from './dto';

const BCRYPT_ROUNDS = 12;
const DUMMY_HASH = '$2b$12$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvwxyzABC';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessJti: string;
  refreshJti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Register tenant + first ADMIN atomically.
   * Uses a single DB transaction. RLS is bypassed for the tenant insert
   * (tenants table has no RLS). For the user insert we SET LOCAL
   * app.current_tenant_id to satisfy the WITH CHECK policy.
   */
  async registerTenant(dto: RegisterTenantDto) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: 'free', isActive: true },
      select: { id: true },
    });
    if (!plan) throw new InternalServerErrorException('Free plan missing — run seed');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let result: { tenant: { id: string; slug: string; name: string }; user: Pick<User, 'id' | 'tenantId' | 'email' | 'role' | 'firstName' | 'lastName'> };

    try {
      result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.tenantName,
            nameAr: dto.tenantNameAr,
            slug: dto.slug,
            email: dto.email,
            planId: plan.id,
            status: 'TRIAL',
            trialEnds: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
          select: { id: true, slug: true, name: true },
        });

        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_tenant_id = '${tenant.id}';`,
        );

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: dto.email,
            passwordHash,
            firstName: dto.firstName,
            lastName: dto.lastName,
            role: 'ADMIN',
          },
          select: {
            id: true, tenantId: true, email: true, role: true,
            firstName: true, lastName: true,
          },
        });

        return { tenant, user };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const target = (err.meta?.target as string[] | undefined) ?? [];
        if (target.includes('slug')) throw new ConflictException('Slug already taken');
        if (target.includes('email')) throw new ConflictException('Email already registered');
        throw new ConflictException('Duplicate value');
      }
      throw err;
    }

    const tokens = await this.issueTokens(result.user);
    return { tenant: result.tenant, user: result.user, ...tokens };
  }

  /**
   * Login:
   *  1. Find tenant by slug (no RLS on tenants).
   *  2. Find user WITHIN that tenant (RLS enforces the filter).
   * Never search by email alone.
   */
  async login(dto: LoginDto): Promise<TokenPair> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenantSlug },
      select: { id: true, status: true },
    });

    if (!tenant) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedException('Invalid credentials');
    }
    if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
      throw new UnauthorizedException('Tenant inactive');
    }

    const user = await this.prisma.withTenant(tenant.id, (tx) =>
      tx.user.findFirst({
        where: { email: dto.email, isActive: true },
        select: {
          id: true, tenantId: true, email: true, role: true, passwordHash: true,
        },
      }),
    );

    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.withTenant(tenant.id, (tx) =>
      tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
    );

    return this.issueTokens(user);
  }

  async refresh(dto: RefreshDto): Promise<TokenPair> {
    const valid = await this.redis.isRefreshTokenValid(dto.userId, dto.jti);
    if (!valid) throw new UnauthorizedException('Refresh token invalid');

    // Look up user across all tenants via asSuperAdmin, then return with
    // their tenantId — the token is signed with it. No cross-tenant leak
    // because we already validated the refresh token.
    const user = await this.prisma.asSuperAdmin((tx) =>
      tx.user.findUnique({
        where: { id: dto.userId },
        select: { id: true, tenantId: true, email: true, role: true, isActive: true },
      }),
    );
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');

    await this.redis.revokeRefreshToken(dto.userId, dto.jti);
    return this.issueTokens(user);
  }

  async logout(userId: string, accessJti: string, refreshJti: string): Promise<void> {
    const ttl = secondsFromTtl(this.config.getOrThrow<string>('jwt.accessTtl'));
    await Promise.all([
      this.redis.revokeRefreshToken(userId, refreshJti),
      this.redis.blacklistAccessToken(accessJti, ttl),
    ]);
  }

  // ---------------- internals ----------------

  private async issueTokens(user: {
    id: string;
    tenantId: string;
    email: string;
    role: User['role'];
  }): Promise<TokenPair> {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id, tenantId: user.tenantId, email: user.email,
        role: user.role, jti: accessJti,
      },
      {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: this.config.getOrThrow<string>('jwt.accessTtl'),
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti: refreshJti },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.getOrThrow<string>('jwt.refreshTtl'),
      },
    );

    await this.redis.storeRefreshToken(
      user.id, refreshJti,
      secondsFromTtl(this.config.getOrThrow<string>('jwt.refreshTtl')),
    );

    return { accessToken, refreshToken, accessJti, refreshJti };
  }
}

function secondsFromTtl(ttl: string): number {
  const m = /^(\d+)([smhd])$/.exec(ttl);
  if (!m) throw new Error(`Invalid TTL: ${ttl}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: throw new Error(`Invalid TTL unit: ${m[2]}`);
  }
}