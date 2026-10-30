/**
 * The last answer each GET path gave, for this signed-in session only.
 *
 * A screen opened again shows these rows at once while useApi asks the API
 * again (stale-while-revalidate). It lives in memory: a reload empties it, and
 * signing in or out clears it, so one user's (or tenant's) rows are never
 * painted for the next one.
 */
const MAX_ENTRIES = 60;
const entries = new Map<string, unknown>();

export function cachedAnswer<T>(path: string): T | undefined {
  return entries.get(path) as T | undefined;
}

export function rememberAnswer(path: string, data: unknown): void {
  entries.delete(path); // re-insert so the oldest entry is the one dropped
  entries.set(path, data);
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
}

/**
 * HOW MANY TIMES THE CACHE HAS BEEN EMPTIED, i.e. how many sign-ins ago.
 *
 * Emptying the map is not enough on its own: every mounted `useApi` still
 * holds the last answer in its own state, and goes on painting it until a new
 * read lands. Two tenants now share the live site, so that stale answer can be
 * the OTHER tenant's company. Readers compare this number and drop what they
 * are holding when it moves.
 */
let generation = 0;

export function cacheGeneration(): number {
  return generation;
}

export function clearApiCache(): void {
  entries.clear();
  generation++;
}
