import { NextResponse } from "next/server";
import {
  categoryBreadcrumb,
  getCategoryMap,
  getEntityMap,
  getPriorityMap,
  getStatusMap,
} from "@/lib/envgate";
import { errorMessage } from "@/lib/utils";

/**
 * GET /api/automation/catalogs
 * Katalog nyata instance InvGate: kategori, prioritas, status, grup.
 * Dipakai Console (select draf) dan Campaign (preview payload) — supaya
 * pilihan user selalu ID asli, bukan karangan.
 */
export async function GET() {
  try {
    const [categories, priorities, statuses, entityMap] = await Promise.all([
      getCategoryMap(),
      getPriorityMap(),
      getStatusMap(),
      getEntityMap(),
    ]);
    return NextResponse.json({
      success: true,
      data: {
        categories: Object.values(categories)
          .map((c) => ({
            id: Number(c.id),
            name: categoryBreadcrumb(categories, c.id) || c.name || "",
          }))
          .filter((c) => c.name),
        priorities: Object.values(priorities)
          .map((p) => ({ id: Number(p.id), name: p.name || `#${p.id}` }))
          .sort((a, b) => a.id - b.id),
        statuses: Object.values(statuses)
          .map((s) => ({ id: Number(s.id), name: s.name || `#${s.id}` }))
          .sort((a, b) => a.id - b.id),
        groups: Object.values(entityMap)
          .filter((e) => e.name)
          .map((e) => ({ id: Number(e.id), name: e.name || "" })),
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Gagal mengambil katalog InvGate") },
      { status: 502 }
    );
  }
}
