// apps/api/src/modules/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RegisterTenantDto, LoginDto } from './dto';

const BCRYPT_ROUNDS = 12;

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
   * Registers a tenant + first ADMIN user in one transaction.
   * Uses `asSuperAdmin` because the tenant doesn't exist yet.
   */
  async registerTenant(dto: RegisterTenantDto) {
    const slugExists = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (slugExists) throw new ConflictException('Slug already taken');

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: 'free', isActive: true },
      select: { id: true },
    });
    if (!plan) throw new Error('Free plan missing — run prisma db seed');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.asSuperAdmin(async (tx) => {
      const emailTaken = await tx.user.findFirst({
        where: { email: dto.email },
        select: { id: true },
      });
      if (emailTaken) throw new ConflictException('Email already registered');

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
          id: true,
          tenantId: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
        },
      });

      const tokens = await this.issueTokens(user);

      return {
        tenant,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        ...tokens,
      };
    });
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true },
      select: {
        id: true,
        tenantId: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    // Constant-ish time: always run bcrypt, even if user missing.
    const dummyHash = '$2b$12$abcdefghijklmnopqrstuvabcdefghijklmnopqrstuvwxyzABC';
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? dummyHash);
    if (!user || !ok) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user);
  }

  async refresh(userId: string, jti: string): Promise<TokenPair> {
    const valid = await this.redis.isRefreshTokenValid(userId, jti);
    if (!valid) throw new UnauthorizedException('Refresh token invalid');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');

    // Rotation: revoke old refresh token, issue new pair.
    await this.redis.revokeRefreshToken(userId, jti);
    return this.issueTokens(user);
  }

  async logout(
    userId: string,
    accessJti: string,
    refreshJti: string,
    accessTtlSeconds: number,
  ): Promise<void> {
    await Promise.all([
      this.redis.revokeRefreshToken(userId, refreshJti),
      this.redis.blacklistAccessToken(accessJti, accessTtlSeconds),
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
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        role: user.role,
        jti: accessJti,
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
      user.id,
      refreshJti,
      secondsFromTtl(this.config.getOrThrow<string>('jwt.refreshTtl')),
    );

    return { accessToken, refreshToken, accessJti, refreshJti };
  }
}

function secondsFromTtl(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid TTL: ${ttl}`);
  const n = Number(match[1]);
  switch (match[2]) {
    case 's': return n;
    case 'm': return n * 60;
    case 'h': return n * 3600;
    case 'd': return n * 86400;
    default: throw new Error(`Invalid TTL unit: ${match[2]}`);
  }
}
