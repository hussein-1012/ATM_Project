/**
 * Raw configuration object consumed via ConfigService.get('...').
 * Values are already validated by env.schema.ts.
 */
export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  mongoUri: process.env.MONGO_URI,
  redisUrl: process.env.REDIS_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
    resetTtl: process.env.JWT_RESET_TTL ?? '10m',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? '*')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  logLevel: process.env.LOG_LEVEL ?? 'info',
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '300', 10),
    authTtl: parseInt(process.env.AUTH_THROTTLE_TTL ?? '60000', 10),
    authLimit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '10', 10),
    reportTtl: parseInt(process.env.REPORT_THROTTLE_TTL ?? '60000', 10),
    reportLimit: parseInt(process.env.REPORT_THROTTLE_LIMIT ?? '5', 10),
  },
  otp: {
    ttlSeconds: parseInt(process.env.OTP_TTL_SECONDS ?? '600', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    cooldownSeconds: parseInt(process.env.OTP_COOLDOWN_SECONDS ?? '60', 10),
  },
  reports: {
    cooldownMinutes: parseFloat(process.env.REPORT_COOLDOWN_MINUTES ?? '30'),
    freshHours: parseFloat(process.env.REPORT_FRESH_HOURS ?? '6'),
  },
  routing: {
    provider: process.env.ROUTING_PROVIDER ?? 'fallback',
    osrmUrl: process.env.OSRM_URL ?? 'https://router.project-osrm.org',
    orsUrl: process.env.ORS_URL ?? 'https://api.openrouteservice.org',
    orsApiKey: process.env.ORS_API_KEY ?? '',
    cacheTtlSeconds: parseInt(process.env.ROUTE_CACHE_TTL_SECONDS ?? '60', 10),
    timeoutMs: parseInt(process.env.ROUTING_TIMEOUT_MS ?? '5000', 10),
  },
  importDefaultFile: process.env.IMPORT_DEFAULT_FILE ?? 'data/atms.json',
  resend: {
    apiKey: process.env.RESEND_API_KEY ?? '',
    from: process.env.RESEND_FROM ?? 'Aqrab Makina Leek <onboarding@resend.dev>',
  },
});
