// apps/api/src/modules/auth/zod-dto.factory.ts
import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

/**
 * Minimal replacement for nestjs-zod: makes a DTO class whose validation
 * happens via Zod at pipe time. We expose the schema so controllers can
 * attach `@UsePipes(new ZodValidationPipe(schema))`.
 */
export function createZodDto<T extends ZodSchema>(schema: T): new () => ReturnType<T['parse']> {
  class ZodDto {}
  Object.defineProperty(ZodDto, 'name', { value: 'ZodDto' });
  Object.defineProperty(ZodDto, 'schema', { value: schema, writable: false });
  return ZodDto as unknown as new () => ReturnType<T['parse']>;
}

export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}
  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          errors: err.flatten().fieldErrors,
        });
      }
      throw err;
    }
  }
}
