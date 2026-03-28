import NodeCache from 'node-cache';

const cache = new NodeCache({
  stdTTL: 45,
  checkperiod: 60,
  useClones: false,
});

export const cacheService = {
  get(key) {
    return cache.get(key);
  },
  set(key, val, ttlSeconds) {
    if (ttlSeconds != null) return cache.set(key, val, ttlSeconds);
    return cache.set(key, val);
  },
  del(key) {
    cache.del(key);
  },
  flush() {
    cache.flushAll();
  },
  keys() {
    return cache.keys();
  },
};
