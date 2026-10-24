import { z } from 'zod';

export const PasswordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128)
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const RegisterTenantSchema = z.object({
  tenantName: z.string().min(2).max(120),
  tenantNameAr: z.string().min(2).max(120).optional(),
  slug: z
    .string()
    .min(3)
    .max(40)
    .regex(
      /^[a-z][a-z0-9-]*$/,
      'Slug must start with a lowercase letter and contain only lowercase letters, digits, or hyphens',
    ),
  email: z.string().email().toLowerCase(),
  password: PasswordSchema,
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
});

export const LoginSchema = z.object({
  tenantSlug: z.string().min(3).max(40).toLowerCase(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const RefreshSchema = z.object({
  userId: z.string().min(1),
  jti: z.string().min(1),
});

export type RegisterTenantInput = z.infer<typeof RegisterTenantSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshInput = z.infer<typeof RefreshSchema>;