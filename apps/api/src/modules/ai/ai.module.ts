import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiInvoiceOcrService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [AiInvoiceOcrService],
  exports: [AiInvoiceOcrService],
})
export class AiModule {}