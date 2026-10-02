// apps/api/src/modules/auth/auth.controller.ts
import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LoginSchema,
  RefreshDto,
  RefreshSchema,
  RegisterTenantDto,
  RegisterTenantSchema,
} from './dto';
import { ZodValidationPipe } from './zod-dto.factory';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register-tenant')
  @ApiOperation({ summary: 'Register a new tenant + first ADMIN user' })
  @UsePipes(new ZodValidationPipe(RegisterTenantSchema))
  register(@Body() dto: RegisterTenantDto) {
    return this.auth.registerTenant(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Authenticate and receive access + refresh tokens' })
  @UsePipes(new ZodValidationPipe(LoginSchema))
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue a new pair' })
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.userId, dto.jti);
  }

  @ApiBearerAuth('access-token')
  @Post('logout')
  @ApiOperation({ summary: 'Revoke refresh token and blacklist access token' })
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  logout(@CurrentUser() user: AuthUser, @Body() dto: RefreshDto) {
    return this.auth.logout(user.id, user.jti, dto.jti, 15 * 60);
  }

  @ApiBearerAuth('access-token')
  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated user' })
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
