import { Redis } from "@upstash/redis";

/**
 * Cache Upstash Redis bersama untuk semua route API.
 * Kalau UPSTASH_REDIS_REST_URL/TOKEN tidak diset, semua pass-through tanpa
 * cache (dev lokal tetap jalan).
 */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  if (!redis) return fn();
  try {
    const hit = await redis.get(key);
    if (hit !== null) return hit as T;
  } catch (e) {
    console.error("Redis get gagal, lanjut tanpa cache:", e);
  }
  const value = await fn();
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (e) {
    console.error("Redis set gagal, lanjut tanpa cache:", e);
  }
  return value;
}

/** Naikkan versi — semua cache dengan versi lama langsung tidak terpakai. */
export async function bump(versionKey: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.incr(versionKey);
  } catch (e) {
    console.error("Redis incr gagal:", e);
  }
}

export async function version(versionKey: string): Promise<number> {
  if (!redis) return 0;
  try {
    return (await redis.get<number>(versionKey)) ?? 0;
  } catch {
    return 0;
  }
}

export const EMPLOYEES_VER = "employees:ver";
