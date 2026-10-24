import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run `fn` inside a transaction with RLS context set to `tenantId`.
   * All calls inside MUST use the provided `tx`.
   */
  async withTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!isValidTenantId(tenantId)) {
      throw new Error('withTenant received an invalid tenantId');
    }
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}';`,
      );
      return fn(tx);
    });
  }

  /**
   * Bypass RLS. ONLY for:
   *  - tenant registration (see auth.service)
   *  - seeds / jobs
   * Never inside request-scoped business logic.
   */
  async asSuperAdmin<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true';`);
      return fn(tx);
    });
  }
}

function isValidTenantId(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9]{20,40}$/i.test(v);
}