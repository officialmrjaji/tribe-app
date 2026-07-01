type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function getCached<T>({
  key,
  load,
  ttlMs,
}: {
  key: string;
  load: () => Promise<T>;
  ttlMs: number;
}) {
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const value = await load();
  cache.set(key, {
    expiresAt: now + ttlMs,
    value,
  });

  return value;
}

export function clearMemoryCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}
