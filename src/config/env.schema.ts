import { z } from 'zod';

/**
 * Environment schema validated at boot (fail fast). See .env.example for docs.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  JWT_RESET_TTL: z.string().default('10m'),

  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(300),
  AUTH_THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),
  AUTH_THROTTLE_LIMIT: z.coerce.number().int().positive().default(10),
  REPORT_THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),
  REPORT_THROTTLE_LIMIT: z.coerce.number().int().positive().default(5),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),

  REPORT_COOLDOWN_MINUTES: z.coerce.number().positive().default(30),
  REPORT_FRESH_HOURS: z.coerce.number().positive().default(6),

  ROUTING_PROVIDER: z.enum(['osrm', 'ors', 'fallback']).default('fallback'),
  OSRM_URL: z.string().default('https://router.project-osrm.org'),
  ORS_URL: z.string().default('https://api.openrouteservice.org'),
  ORS_API_KEY: z.string().optional().default(''),
  ROUTE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  ROUTING_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  IMPORT_DEFAULT_FILE: z.string().default('data/atms.json'),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production') {
    if (env.JWT_ACCESS_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_SECRET'],
        message: 'JWT_ACCESS_SECRET must be at least 32 characters in production',
      });
    }
    if (env.JWT_REFRESH_SECRET.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must be at least 32 characters in production',
      });
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }
    if (env.ROUTING_PROVIDER === 'ors' && !env.ORS_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ORS_API_KEY'],
        message: 'ORS_API_KEY is required when ROUTING_PROVIDER=ors',
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;
