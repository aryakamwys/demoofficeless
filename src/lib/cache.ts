import { Redis } from "@upstash/redis";
import { createClient } from "redis";

/**
 * Cache bersama untuk semua route API.
 * Prioritas: REDIS_INTERNAL_URL (VPS, protokol redis://) →
 * UPSTASH_REDIS_REST_URL/TOKEN (cloud) → tanpa cache (dev tetap jalan).
 */
const internalUrl = process.env.REDIS_INTERNAL_URL;
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const internal = internalUrl ? createClient({ url: internalUrl }) : null;
internal?.on("error", (e) => console.error("Redis internal error:", e));
internal?.connect().catch(() => console.error("Redis internal connect gagal"));

const upstash =
  upstashUrl && upstashToken
    ? new Redis({ url: upstashUrl, token: upstashToken })
    : null;

type MinimalRedis = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown, opts?: { EX?: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
};

const client: MinimalRedis | null = (internal ?? upstash) as MinimalRedis | null;

const ttlOpt = (ttlSeconds: number) =>
  internal ? { EX: ttlSeconds } : ({ ex: ttlSeconds } as { EX?: number });

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  if (!client) return fn();
  try {
    const hit = await client.get(key);
    // internal redis: raw JSON string → parse; upstash: already deserialized
    if (hit !== null) return (typeof hit === "string" ? JSON.parse(hit) : hit) as T;
  } catch (e) {
    console.error("Redis get gagal, lanjut tanpa cache:", e);
  }
  const value = await fn();
  try {
    await client.set(key, JSON.stringify(value), ttlOpt(ttlSeconds));
  } catch (e) {
    console.error("Redis set gagal:", e);
  }
  return value;
}

/** Naikkan versi — semua cache dengan versi lama langsung tidak terpakai. */
export async function bump(versionKey: string): Promise<void> {
  if (!client) return;
  try {
    await client.incr(versionKey);
  } catch (e) {
    console.error("Redis incr gagal:", e);
  }
}

export async function version(versionKey: string): Promise<number> {
  if (!client) return 0;
  try {
    const v = await client.get(versionKey);
    return v ? Number(v) : 0;
  } catch {
    return 0;
  }
}

export const EMPLOYEES_VER = "employees:ver";
