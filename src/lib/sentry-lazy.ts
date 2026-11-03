/**
 * Lazy Sentry loader — SDK ko har route ke initial chunk se bahar rakhta hai.
 *
 * `sentry.client.config.ts` idle par isse init karta hai; error boundaries bhi
 * isi se capture karte hain (idle init abhi chala ho ya na ho, `getClient()`
 * guard double init nahi hone deta). DSN missing = SDK download hi nahi.
 */
let loading: Promise<typeof import("@sentry/nextjs")> | null = null;

export function ensureSentry(): Promise<typeof import("@sentry/nextjs")> {
  if (!loading) {
    loading = import("@sentry/nextjs").then((Sentry) => {
      const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;
      if (dsn && !Sentry.getClient()) {
        // Replay off: replayIntegration bundle me nahi hai; error tracking + 10% traces kaafi hain.
        Sentry.init({ dsn, tracesSampleRate: 0.1 });
      }
      return Sentry;
    });
  }
  return loading;
}
