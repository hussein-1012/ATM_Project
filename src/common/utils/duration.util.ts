/** Parses simple duration strings used by env config: "30d", "12h", "15m", "45s", "500ms". */
export function parseDurationMs(value: string, fallbackMs: number): number {
  const m = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(value.trim());
  if (!m) return fallbackMs;
  const amount = parseInt(m[1], 10);
  switch ((m[2] ?? 'ms').toLowerCase()) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    case 'd':
      return amount * 86_400_000;
    default:
      return fallbackMs;
  }
}
