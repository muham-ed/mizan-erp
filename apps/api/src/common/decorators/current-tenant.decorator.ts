// apps/api/src/common/decorators/current-tenant.decorator.ts
import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Returns the tenantId from the authenticated user.
 * NEVER reads from headers, query, or body — only from the JWT-verified user.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ user?: { tenantId?: string } }>();
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant context missing');
    return tenantId;
  },
);
