import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('redisUrl'), {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
      enableReadyCheck: true,
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.client.status === 'ready') {
      this.logger.log('Redis connected');
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.client.once('ready', () => { this.logger.log('Redis connected'); resolve(); });
      this.client.once('error', reject);
    });
  }

  async onModuleDestroy(): Promise<void> { await this.client.quit(); }

  private rtKey(userId: string, jti: string): string { return `rt:${userId}:${jti}`; }
  private blKey(jti: string): string { return `bl:${jti}`; }

  async storeRefreshToken(userId: string, jti: string, ttl: number): Promise<void> {
    await this.client.set(this.rtKey(userId, jti), '1', 'EX', ttl);
  }
  async isRefreshTokenValid(userId: string, jti: string): Promise<boolean> {
    return (await this.client.exists(this.rtKey(userId, jti))) === 1;
  }
  async revokeRefreshToken(userId: string, jti: string): Promise<void> {
    await this.client.del(this.rtKey(userId, jti));
  }
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    const stream = this.client.scanStream({ match: `rt:${userId}:*`, count: 100 });
    const keys: string[] = [];
    for await (const k of stream) keys.push(...(k as string[]));
    if (keys.length) await this.client.del(...keys);
  }
  async blacklistAccessToken(jti: string, ttl: number): Promise<void> {
    if (ttl <= 0) return;
    await this.client.set(this.blKey(jti), '1', 'EX', ttl);
  }
  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    return (await this.client.exists(this.blKey(jti))) === 1;
  }
}