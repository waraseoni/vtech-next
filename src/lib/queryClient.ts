import { QueryClient } from "@tanstack/react-query";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 30s fresh: mount par dobara network call nahi -> back/forward instant.
        staleTime: 30_000,
        // Inactive rehne par 5 min baad memory se hata do.
        gcTime: 5 * 60_000,
        // App me tab-focus churn bahut hai; focus par refetch = faltu load.
        refetchOnWindowFocus: false,
        // React Query ka default 3 retries slow network par "hang" feel karata
        // tha — ek retry kaafi hai.
        retry: 1,
      },
    },
  });
}

// Server render par har request ka alag QueryClient (SSR isolation),
// browser me ek hi singleton — cache navigation ke beech bacha rahe.
// Ref: node_modules/next/dist/docs/01-app/02-guides/client-side-data-fetching/tanstack-query.md
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  return (browserQueryClient ??= makeQueryClient());
}
