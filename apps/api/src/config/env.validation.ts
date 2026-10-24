import { z } from 'zod';

const hexMin64 = z
  .string()
  .regex(/^[a-f0-9]{64,}$/i, 'Must be a hex string of at least 64 chars');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url(),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(120),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: hexMin64,
  JWT_REFRESH_SECRET: hexMin64,
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  AI_PROVIDER: z.enum(['mock', 'openai', 'gemini', 'claude']).default('mock'),
  AI_API_KEY: z.string().optional().nullable(),
  AI_MODEL: z.string().default('gpt-4o-mini'),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('❌ Invalid env:', JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    throw new Error('Invalid environment variables');
  }
  if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  return parsed.data;
}