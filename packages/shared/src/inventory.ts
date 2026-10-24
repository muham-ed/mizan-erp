import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z.string().min(2).max(100),
  nameAr: z.string().min(2).max(100).optional(),
  parentId: z.string().optional(),
});

export const CreateProductSchema = z.object({
  sku: z.string().min(2).max(50),
  barcode: z.string().optional(),
  name: z.string().min(2).max(200),
  nameAr: z.string().min(2).max(200).optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unit: z.string().default('pcs'),
  costPrice: z.number().nonnegative(),
  salePrice: z.number().nonnegative(),
  taxRate: z.number().min(0).max(100).default(14),
  reorderLevel: z.number().int().nonnegative().default(5),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type CreateProductInput = z.infer<typeof CreateProductSchema>;