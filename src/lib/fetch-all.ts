// Supabase/PostgREST caps each request at 1000 rows (server max-rows).
// Use these helpers to page through large result sets with `.range()`.
// `.range()` overrides any earlier `.limit()`, so leftover `.limit(...)` calls are harmless.

export async function fetchAll<T = any>(q: any): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await q.range(page * 1000, (page + 1) * 1000 - 1);
    if (error) throw error;
    if (data?.length) out.push(...data);
    if (!data || data.length < 1000) break;
  }
  return out;
}

export const pageAll = async (q: any) => ({ data: await fetchAll(q) });

// Fetch with a filter on an id list: splits the ids into chunks (keeps the
// request URL small) and paginates each chunk (handles the 1000-row cap).
export async function fetchAllIn<T = any, I = number | string>(
  makeQuery: (ids: I[]) => any,
  ids: I[]
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    out.push(...(await fetchAll<T>(makeQuery(chunk))));
  }
  return out;
}
