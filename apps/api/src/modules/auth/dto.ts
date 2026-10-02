// apps/api/src/modules/auth/dto.ts
import { z } from 'zod';
import { createZodDto } from './zod-dto.factory';

const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a digit');

export const RegisterTenantSchema = z.object({
  tenantName: z.string().min(2).max(120),
  tenantNameAr: z.string().min(2).max(120).optional(),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z][a-z0-9-]*$/, 'Slug must be lowercase, digits, or dashes'),
  email: z.string().email().toLowerCase(),
  password: PasswordSchema,
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
});
export class RegisterTenantDto extends createZodDto(RegisterTenantSchema) {}

export const LoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(128),
});
export class LoginDto extends createZodDto(LoginSchema) {}

export const RefreshSchema = z.object({
  userId: z.string().min(1),
  jti: z.string().min(1),
});
export class RefreshDto extends createZodDto(RefreshSchema) {}
