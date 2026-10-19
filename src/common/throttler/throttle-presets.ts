/**
 * Route-level throttle presets. Read from process.env at import time; main.ts
 * loads dotenv before importing AppModule so .env values are honoured, and in
 * containers the env is already present.
 */
function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const AUTH_THROTTLE = {
  default: {
    limit: positiveInt(process.env.AUTH_THROTTLE_LIMIT, 10),
    ttl: positiveInt(process.env.AUTH_THROTTLE_TTL, 60_000),
  },
};

export const REPORT_THROTTLE = {
  default: {
    limit: positiveInt(process.env.REPORT_THROTTLE_LIMIT, 5),
    ttl: positiveInt(process.env.REPORT_THROTTLE_TTL, 60_000),
  },
};
