import { z } from 'zod';

export const UserRoleSchema = z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE']);
export type UserRoleType = z.infer<typeof UserRoleSchema>;

export const TenantStatusSchema = z.enum([
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
]);
export type TenantStatusType = z.infer<typeof TenantStatusSchema>;