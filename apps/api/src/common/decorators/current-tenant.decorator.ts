import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/** Returns tenantId from the JWT-verified user. Never from headers/body. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<{ user?: { tenantId?: string } }>();
    const tenantId = req.user?.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant context missing');
    return tenantId;
  },
);