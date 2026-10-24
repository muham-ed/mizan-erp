import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRole } from '@prisma/client';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { RedisService } from '../../../redis/redis.service';

export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: UserRole;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService, private readonly redis: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthUser> {
    if (!payload.sub || !payload.tenantId || !payload.jti) {
      throw new UnauthorizedException('Malformed token payload');
    }
    if (await this.redis.isAccessTokenBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Token revoked');
    }
    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role,
      jti: payload.jti,
    };
  }
}