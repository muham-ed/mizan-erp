// apps/api/src/modules/inventory/inventory.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CreateCategorySchema, CreateProductSchema } from '@mizan/shared';

import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../auth/zod-dto.factory';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // ================= Categories =================

  @Post('categories')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create product category' })
  @UsePipes(new ZodValidationPipe(CreateCategorySchema))
  createCategory(@CurrentTenant() tenantId: string, @Body() body: any) {
    return this.inventory.createCategory(tenantId, body);
  }

  @Get('categories')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get category list' })
  getCategories(@CurrentTenant() tenantId: string) {
    return this.inventory.getCategories(tenantId);
  }

  // ================= Products =================

  @Post('products')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Create new product' })
  @UsePipes(new ZodValidationPipe(CreateProductSchema))
  createProduct(@CurrentTenant() tenantId: string, @Body() body: any) {
    return this.inventory.createProduct(tenantId, body);
  }

  @Get('products')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List tenant products' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  getProducts(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.inventory.getProducts(tenantId, {
      search,
      categoryId,
      lowStock: lowStock === 'true',
    });
  }

  @Get('products/:id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get product by ID with stock levels' })
  getProductById(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.inventory.getProductById(tenantId, id);
  }

  // ================= Stock Movements =================

  @Post('stock-movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Record inventory stock movement (IN, OUT, ADJUSTMENT)' })
  recordStockMovement(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      productId: string;
      warehouseId?: string;
      type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
      quantity: number;
      reference?: string;
      notes?: string;
    },
  ) {
    return this.inventory.recordStockMovement(tenantId, user.id, body);
  }

  @Get('stock-movements')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get stock movement audit history' })
  getStockMovements(@CurrentTenant() tenantId: string) {
    return this.inventory.getStockMovements(tenantId);
  }
}
