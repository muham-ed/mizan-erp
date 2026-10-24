// apps/api/src/modules/auth/dto.ts
import {
  RegisterTenantSchema,
  LoginSchema,
  RefreshSchema,
} from '@mizan/shared';
import { createZodDto } from './zod-dto.factory';

export class RegisterTenantDto extends createZodDto(RegisterTenantSchema) {}
export class LoginDto extends createZodDto(LoginSchema) {}
export class RefreshDto extends createZodDto(RefreshSchema) {}

export {
  RegisterTenantSchema,
  LoginSchema,
  RefreshSchema,
};
