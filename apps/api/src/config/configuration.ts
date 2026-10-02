// apps/api/src/config/configuration.ts
export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  webOrigin: string;
  rateLimitPerMin: number;
  databaseUrl: string;
  redisUrl: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  ai: {
    provider: 'mock' | 'openai' | 'gemini' | 'claude';
    apiKey: string | null;
    model: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  rateLimitPerMin: Number(process.env.RATE_LIMIT_PER_MIN ?? 120),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  ai: {
    provider: (process.env.AI_PROVIDER as AppConfig['ai']['provider']) ?? 'mock',
    apiKey: process.env.AI_API_KEY ?? null,
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
  },
});
