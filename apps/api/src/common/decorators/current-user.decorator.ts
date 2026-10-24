import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
  jti: string;
}

export const CurrentUser = createParamDecorator(
  <K extends keyof AuthUser | undefined>(
    data: K,
    ctx: ExecutionContext,
  ): K extends keyof AuthUser ? AuthUser[K] : AuthUser => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return (data ? req.user[data] : req.user) as never;
  },
);