import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Replay off: replayIntegration bundle me nahi hai; error tracking + 10% traces kaafi hain.
    tracesSampleRate: 0.1,
  });
}
