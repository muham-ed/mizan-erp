// apps/api/src/modules/inventory/inventory.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateCategoryInput, CreateProductInput } from '@mizan/shared';

import { PrismaService } from '../../prisma/prisma.service';

export interface CreateStockMovementInput {
  productId: string;
  warehouseId?: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  reference?: string;
  notes?: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= Categories =================

  async createCategory(tenantId: string, input: CreateCategoryInput) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const existing = await tx.category.findFirst({
        where: { name: input.name },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(`Category "${input.name}" already exists`);
      }

      return tx.category.create({
        data: {
          tenantId,
          name: input.name,
          nameAr: input.nameAr,
          parentId: input.parentId,
        },
      });
    });
  }

  async getCategories(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.category.findMany({
        include: { children: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  // ================= Products =================

  async createProduct(tenantId: string, input: CreateProductInput) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      // 1. Check SKU uniqueness for this tenant
      const existingSku = await tx.product.findFirst({
        where: { sku: input.sku },
        select: { id: true },
      });
      if (existingSku) {
        throw new ConflictException(`Product SKU "${input.sku}" already exists`);
      }

      // 2. Find or create default warehouse for tenant
      let warehouse = await tx.warehouse.findFirst({
        where: { isDefault: true },
        select: { id: true },
      });

      if (!warehouse) {
        warehouse = await tx.warehouse.create({
          data: {
            tenantId,
            name: 'المخزن الرئيسي',
            nameAr: 'المخزن الرئيسي',
            isDefault: true,
          },
          select: { id: true },
        });
      }

      // 3. Create Product & initial stock level
      const product = await tx.product.create({
        data: {
          tenantId,
          sku: input.sku,
          barcode: input.barcode,
          name: input.name,
          nameAr: input.nameAr,
          description: input.description,
          categoryId: input.categoryId,
          unit: input.unit ?? 'pcs',
          costPrice: input.costPrice,
          salePrice: input.salePrice,
          taxRate: input.taxRate ?? 14,
          reorderLevel: input.reorderLevel ?? 5,
        },
      });

      await tx.stockLevel.create({
        data: {
          tenantId,
          productId: product.id,
          warehouseId: warehouse.id,
          quantity: 0,
        },
      });

      return product;
    });
  }

  async getProducts(
    tenantId: string,
    query?: { search?: string; categoryId?: string; lowStock?: boolean },
  ) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.ProductWhereInput = {
        isActive: true,
      };

      if (query?.categoryId) {
        where.categoryId = query.categoryId;
      }

      if (query?.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { nameAr: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
          { barcode: { contains: query.search, mode: 'insensitive' } },
        ];
      }

      const products = await tx.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, nameAr: true } },
          stockLevels: { select: { quantity: true, warehouseId: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (query?.lowStock) {
        return products.filter((p) => {
          const totalStock = p.stockLevels.reduce(
            (acc, sl) => acc + Number(sl.quantity),
            0,
          );
          return totalStock <= p.reorderLevel;
        });
      }

      return products;
    });
  }

  async getProductById(tenantId: string, productId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: {
          category: true,
          stockLevels: { include: { warehouse: true } },
          stockMovements: { take: 10, orderBy: { createdAt: 'desc' } },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID "${productId}" not found`);
      }

      return product;
    });
  }

  // ================= Stock Movements =================

  async recordStockMovement(
    tenantId: string,
    userId: string,
    input: CreateStockMovementInput,
  ) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true },
      });
      if (!product) throw new NotFoundException('Product not found');

      let warehouseId = input.warehouseId;
      if (!warehouseId) {
        const defaultWh = await tx.warehouse.findFirst({
          where: { isDefault: true },
          select: { id: true },
        });
        if (!defaultWh) throw new NotFoundException('Default warehouse not found');
        warehouseId = defaultWh.id;
      }

      // Upsert stock level
      const currentStockLevel = await tx.stockLevel.findUnique({
        where: {
          productId_warehouseId: {
            productId: input.productId,
            warehouseId,
          },
        },
      });

      const currentQty = currentStockLevel ? Number(currentStockLevel.quantity) : 0;
      let qtyDelta = Number(input.quantity);

      if (input.type === 'OUT') {
        qtyDelta = -Math.abs(qtyDelta);
      } else if (input.type === 'IN') {
        qtyDelta = Math.abs(qtyDelta);
      } else if (input.type === 'ADJUSTMENT') {
        qtyDelta = Number(input.quantity) - currentQty;
      }

      const newQty = currentQty + qtyDelta;

      await tx.stockLevel.upsert({
        where: {
          productId_warehouseId: {
            productId: input.productId,
            warehouseId,
          },
        },
        create: {
          tenantId,
          productId: input.productId,
          warehouseId,
          quantity: newQty,
        },
        update: {
          quantity: newQty,
        },
      });

      return tx.stockMovement.create({
        data: {
          tenantId,
          productId: input.productId,
          warehouseId,
          userId,
          type: input.type,
          quantity: input.quantity,
          reference: input.reference,
          notes: input.notes,
        },
      });
    });
  }

  async getStockMovements(tenantId: string) {
    return this.prisma.withTenant(tenantId, (tx) =>
      tx.stockMovement.findMany({
        include: {
          product: { select: { id: true, sku: true, name: true, nameAr: true } },
          user: { select: { id: true, firstName: true, lastName: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  }
}
