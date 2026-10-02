// apps/api/src/prisma/prisma.service.ts
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * PrismaService — the ONLY way to talk to the database.
 *
 * RULES:
 *  1. Every tenant-scoped operation MUST go through `withTenant()`.
 *  2. `asSuperAdmin()` is only for platform tasks (tenant creation, seed).
 *  3. NEVER pass a tenantId that came from the client directly.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? ['error']
          : ['warn', 'error'],
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
   * Executes `fn` inside a transaction with RLS context set to `tenantId`.
   * All Prisma calls inside MUST use the provided `tx`, not `this`.
   *
   * @example
   *   return this.prisma.withTenant(tenantId, async (tx) => {
   *     const product = await tx.product.create({ data: {...} });
   *     await tx.stockLevel.create({ data: {...} });
   *     return product;
   *   });
   */
  async withTenant<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!isValidCuid(tenantId)) {
      throw new Error('withTenant received an invalid tenantId');
    }
    return this.$transaction(async (tx) => {
      // SET LOCAL is safe here because the value is validated as a cuid.
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${tenantId}';`,
      );
      return fn(tx);
    });
  }

  /**
   * Bypasses RLS. Only for:
   *  - Tenant registration
   *  - Cross-tenant analytics (later)
   *  - Seeds / jobs
   */
  async asSuperAdmin<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true';`);
      return fn(tx);
    });
  }
}

/**
 * cuid v1 is 25 chars starting with 'c'. cuid v2 may differ — be lenient
 * but strict enough to reject SQL injection attempts.
 */
function isValidCuid(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9]{20,40}$/i.test(v);
}
