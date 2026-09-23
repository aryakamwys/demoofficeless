import { cached } from "@/lib/cache";

/**
 * Semua akses ke InvGate Service Desk (EnvGate) + cache Upstash Redis.
 *
 * TTL:
 *  - entity map (helpdesks/levels): 24 jam  — hampir tidak pernah berubah
 *  - users: 24 jam                    — nama jarang berubah
 *  - tiket tunggal: 5 menit
 *  - daftar tiket terbaru: 5 menit
 */

const BASE = "https://servicedesk.perkom.co.id/api/v1";

/** Bentuk data InvGate yang dipakai — field tidak wajib ada semua. */
interface InvEntity {
  id?: string | number;
  name?: string;
  parent_id?: string | number;
}

interface InvUser {
  id?: string | number;
  first_name?: string;
  last_name?: string;
  lastname?: string;
  name?: string;
  email?: string;
}

interface MappedUser {
  id?: string | number;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
}

export interface InvTicket {
  id: number;
  category_id?: number;
  assigned_group_id?: number;
  assigned_id?: number;
  requester_id?: number;
  created_at?: string | number;
  category_details?: { id: number; name: string };
  assigned_group_details?: { id: number; name: string };
  assigned_user?: MappedUser | null;
  requester_user?: MappedUser | null;
}

interface StatusPage {
  total?: number;
  requestIds?: number[];
  response?: { requestIds?: number[] };
}

async function api<T = unknown>(path: string): Promise<T> {
  const username = process.env.SERVICEDESK_USERNAME;
  const password = process.env.SERVICEDESK_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "SERVICEDESK_USERNAME dan SERVICEDESK_PASSWORD belum diset di environment"
    );
  }

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`EnvGate API error: ${res.status} ${res.statusText} (${path})`);
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // InvGate membalas HTML login page saat kredensial invalid / sesi hangus
    throw new Error(
      `EnvGate API membalas non-JSON untuk ${path} — kemungkinan kredensial invalid`
    );
  }
}

/** Ambil payload list dari berbagai bentuk respons InvGate. */
function unwrap(r: unknown): unknown[] {
  const w = r as { response?: unknown; data?: unknown } | null | undefined;
  const raw = w?.response ?? w?.data ?? r;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw);
  return [];
}

// ---------------------------------------------------------------------------
// Entity map: helpdesks (type_id=2) + levels (type_id=1) berbagi ruang ID yang
// sama; category_id maupun assigned_group_id pada incident bisa menunjuk salah
// satunya. Disatukan jadi satu map, lalu nama level ditelusuri ke parent-nya.

async function fetchEntityMap(): Promise<Record<string | number, InvEntity>> {
  const map: Record<string | number, InvEntity> = {};
  for (const path of ["/helpdesks", "/levels"]) {
    try {
      const list = unwrap(await api(path)) as InvEntity[];
      for (const e of list) {
        if (e?.id != null && !map[e.id]) map[e.id] = e;
      }
    } catch (e) {
      console.error(`Gagal fetch ${path}:`, e);
    }
  }
  return map;
}

export const getEntityMap = () =>
  cached("envgate:entities", 24 * 3600, fetchEntityMap);

/** Pure: nama entity dari map gabungan, level tanpa nama naik ke parent. */
export function resolveEntityName(
  map: Record<string | number, InvEntity | undefined>,
  id: number | string
): string {
  const item = map[id];
  if (!item) return "";
  if (item.name) return item.name;
  const parent = item.parent_id != null ? map[Number(item.parent_id)] : null;
  return parent?.name || "";
}

// ---------------------------------------------------------------------------
// Users

async function fetchUsers(ids: number[]): Promise<Record<string | number, InvUser>> {
  const query = ids.map((i) => `ids[]=${i}`).join("&");
  const list = unwrap(await api(`/users?${query}`)) as InvUser[];
  const out: Record<string | number, InvUser> = {};
  for (const u of list) {
    if (u?.id != null) out[u.id] = u;
  }
  return out;
}

export async function getUsers(ids: Array<number | string | null | undefined>) {
  const unique = [...new Set(ids.filter((i): i is number => i != null))];
  if (unique.length === 0) return {};
  const key = [...unique].sort((a, b) => a - b).join(",");
  return cached(`envgate:users:${key}`, 24 * 3600, () => fetchUsers(unique));
}

/** Pure: normalisasi field nama user InvGate (name/first_name/lastname variasi). */
export function mapUser(u: InvUser | null | undefined): MappedUser | null {
  if (!u) return null;
  const first_name = u.first_name ?? u.name ?? "";
  const last_name = u.last_name ?? u.lastname ?? "";
  return {
    id: u.id,
    first_name,
    last_name,
    name: [first_name, last_name].filter(Boolean).join(" "),
    email: u.email ?? "",
  };
}

// ---------------------------------------------------------------------------
// Decorate: tempel category_details, assigned_group_details, dan nama user
// tanpa memutasi objek asli (hasil bisa jadi milik cache).

function decorate(
  items: InvTicket[],
  entityMap: Record<string | number, InvEntity>,
  users: Record<string | number, InvUser>
) {
  return items.map((item) => {
    const out: InvTicket = { ...item };
    if (out.category_id != null) {
      const name = resolveEntityName(entityMap, out.category_id);
      if (name) out.category_details = { id: out.category_id, name };
    }
    if (out.assigned_group_id != null) {
      const name = resolveEntityName(entityMap, out.assigned_group_id);
      if (name) out.assigned_group_details = { id: out.assigned_group_id, name };
    }
    if (out.assigned_id != null) {
      out.assigned_user = mapUser(users[out.assigned_id]);
    }
    if (out.requester_id != null) {
      out.requester_user = mapUser(users[out.requester_id]);
    }
    return out;
  });
}

function userIdsOf(items: InvTicket[]): Array<number | undefined> {
  return items.flatMap((i) => [i.assigned_id, i.requester_id]);
}

// ---------------------------------------------------------------------------
// Public: tiket tunggal & daftar tiket terbaru

export async function getTicket(id: string): Promise<InvTicket | null> {
  return cached(`envgate:ticket:${id}`, 300, async () => {
    const raw = await api(`/incidents?ids[]=${encodeURIComponent(id)}`);
    let inc: InvTicket | null = null;
    if (Array.isArray(raw) && raw.length > 0) {
      inc = raw[0] as InvTicket;
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      inc = (obj[id] ?? Object.values(obj)[0] ?? null) as InvTicket | null;
    }
    if (!inc) return null;

    const [entityMap, users] = await Promise.all([
      getEntityMap(),
      getUsers(userIdsOf([inc])),
    ]);
    return decorate([inc], entityMap, users)[0];
  });
}

export async function getRecentTickets(
  fromDateStr: string | null,
  toDateStr: string | null
): Promise<InvTicket[]> {
  const key = `envgate:recent:${fromDateStr || ""}:${toDateStr || ""}`;
  return cached(key, 300, async () => {
    const statusQuery = [1, 2, 3, 4, 5, 6]
      .map((id) => `status_ids[]=${id}`)
      .join("&");

    // Ambil total dulu supaya bisa offset ke item terbaru
    const first = await api<StatusPage>(`/incidents.by.status?${statusQuery}&limit=1`);
    const total = first.total || 0;
    const limit = fromDateStr || toDateStr ? 200 : 50;
    const offset = total > limit ? total - limit : 0;

    const page = await api<StatusPage>(
      `/incidents.by.status?${statusQuery}&limit=${limit}&offset=${offset}`
    );
    const ids = page.requestIds ?? page.response?.requestIds ?? [];
    if (!Array.isArray(ids) || ids.length === 0) return [];

    const details = await api(
      `/incidents?${ids.map((i: number) => `ids[]=${i}`).join("&")}`
    );
    let items = (unwrap(details) as InvTicket[]).sort((a, b) => b.id - a.id);

    // Filter tanggal (created_at bisa unix detik/detik-ms/string tanggal)
    if (fromDateStr || toDateStr) {
      items = items.filter((item) => {
        if (!item.created_at) return true;
        let d = new Date(item.created_at);
        if (/^\d+$/.test(String(item.created_at))) {
          const num = parseInt(String(item.created_at), 10);
          d = new Date(num > 9999999999 ? num : num * 1000);
        }
        if (isNaN(d.getTime())) return true;

        if (fromDateStr) {
          const from = new Date(fromDateStr);
          from.setHours(0, 0, 0, 0);
          if (d < from) return false;
        }
        if (toDateStr) {
          const to = new Date(toDateStr);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      });
    }

    const [entityMap, users] = await Promise.all([
      getEntityMap(),
      getUsers(userIdsOf(items)),
    ]);
    return decorate(items, entityMap, users);
  });
}
