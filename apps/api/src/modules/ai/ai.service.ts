import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ExtractedInvoice {
  vendorName: string | null;
  taxNumber: string | null;
  invoiceNumber: string | null;
  date: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  confidenceScore: number;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
]);

@Injectable()
export class AiInvoiceOcrService {
  private readonly logger = new Logger(AiInvoiceOcrService.name);

  constructor(private readonly config: ConfigService) {}

  async processInvoiceImage(fileBuffer: Buffer, mimeType: string): Promise<ExtractedInvoice> {
    if (!fileBuffer?.length) throw new BadRequestException('Empty file');
    if (fileBuffer.length > MAX_BYTES) throw new BadRequestException('File too large');
    if (!ALLOWED_MIME.has(mimeType)) throw new BadRequestException(`Unsupported type: ${mimeType}`);

    const provider = this.config.getOrThrow<'mock' | 'openai' | 'gemini' | 'claude'>('ai.provider');
    const apiKey = this.config.get<string | null>('ai.apiKey');

    if (provider === 'mock' || !apiKey) {
      this.logger.warn('Using MOCK OCR');
      return this.mockResult();
    }

    switch (provider) {
      case 'openai': return this.callOpenAI(fileBuffer, mimeType, apiKey);
      case 'claude':
      case 'gemini': throw new ServiceUnavailableException(`${provider} not implemented`);
      default: throw new BadRequestException(`Unknown provider: ${provider}`);
    }
  }

  private async callOpenAI(buffer: Buffer, mimeType: string, apiKey: string): Promise<ExtractedInvoice> {
    const model = this.config.getOrThrow<string>('ai.model');
    const base64 = buffer.toString('base64');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Extract structured invoice data as JSON: vendorName, taxNumber, invoiceNumber, date, subtotal, taxAmount, totalAmount, currency, lineItems[], confidenceScore. Arabic + English.' },
            { role: 'user', content: [
              { type: 'text', text: 'Extract the invoice.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ]},
          ],
        }),
      });

      if (!res.ok) {
        this.logger.error(`OpenAI ${res.status}: ${await res.text().catch(() => '')}`);
        throw new ServiceUnavailableException('OCR failed');
      }
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const raw = json.choices?.[0]?.message?.content;
      if (!raw) throw new ServiceUnavailableException('Empty OCR response');
      return this.parseExtracted(raw);
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ServiceUnavailableException('OCR timeout');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseExtracted(raw: string): ExtractedInvoice {
    let json: unknown;
    try { json = JSON.parse(raw); } catch { throw new ServiceUnavailableException('Non-JSON AI response'); }
    if (!json || typeof json !== 'object') throw new ServiceUnavailableException('Invalid AI shape');
    const o = json as Record<string, unknown>;

    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

    const items = Array.isArray(o.lineItems) ? o.lineItems : [];
    const lineItems = items.map((it) => {
      const i = (it ?? {}) as Record<string, unknown>;
      return {
        description: str(i.description) ?? 'Item',
        quantity: num(i.quantity),
        unitPrice: num(i.unitPrice),
        totalPrice: num(i.totalPrice),
      };
    });

    const confidence = num(o.confidenceScore);
    return {
      vendorName: str(o.vendorName),
      taxNumber: str(o.taxNumber),
      invoiceNumber: str(o.invoiceNumber),
      date: str(o.date),
      subtotal: num(o.subtotal),
      taxAmount: num(o.taxAmount),
      totalAmount: num(o.totalAmount),
      currency: str(o.currency) ?? 'EGP',
      lineItems,
      confidenceScore: Math.min(Math.max(confidence, 0), 1),
    };
  }

  private mockResult(): ExtractedInvoice {
    return {
      vendorName: 'شركة النور للمستلزمات الطبية والعمومية',
      taxNumber: '100-234-890',
      invoiceNumber: 'INV-2025-0042',
      date: '2025-02-15',
      subtotal: 1000,
      taxAmount: 140,
      totalAmount: 1140,
      currency: 'EGP',
      lineItems: [
        { description: 'كرتونة ورق تصوير A4', quantity: 5, unitPrice: 120, totalPrice: 600 },
        { description: 'حبر طابعة أسود HP', quantity: 1, unitPrice: 400, totalPrice: 400 },
      ],
      confidenceScore: 0.94,
    };
  }
}