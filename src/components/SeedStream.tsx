import { Suspense, type ReactNode } from "react";

/**
 * RSC seed streaming helper (NAV PERF audit, 29 Nov 2026).
 *
 * Problem: route layouts seed ko `await` kar rahe the —
 *
 *     const seed = await loadSeed(...);       // DB round-trip
 *     return <Provider seed={seed}>{children}</Provider>;
 *
 * Isse RSC response ke headers hi DB ke baad flush hote the. Client navigation
 * par router ko pura response chahiye hota hai, isliye click ke baad page
 * "freeze" lagta tha (koi skeleton bhi nahi, kyunki segment me loading.tsx bhi
 * nahi tha).
 *
 * Fix: promise ko await mat karo — `SeedStream` ke andar do. Shell/skeleton
 * turant stream hota hai, data resolve hone par children render hote hain.
 * Pattern `src/app/jobs/[id]/view/layout.tsx` se liya gaya hai (wahan already
 * aise hi kaam karta hai).
 *
 * NOTE: auth gate (`requireStaffWithRole` + `redirect`) boundary ke BAHAR
 * rakhein — warna server-side redirect client-side redirect ban jata hai.
 */
export function SeedStream<T>({
  promise,
  fallback,
  children,
}: {
  promise: Promise<T>;
  fallback: ReactNode;
  /** Seed milne ke baad render (render-prop — server→server, koi client boundary nahi). */
  children: (seed: T) => ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <SeedResolved promise={promise}>{children}</SeedResolved>
    </Suspense>
  );
}

async function SeedResolved<T>({
  promise,
  children,
}: {
  promise: Promise<T>;
  children: (seed: T) => ReactNode;
}) {
  return <>{children(await promise)}</>;
}
