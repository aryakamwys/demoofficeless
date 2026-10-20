import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase-server";

/**
 * POST /api/automation/events — catat event eksekusi ke tabel openclaw_events
 * (migration 026). Best-effort: bila tabel belum di-apply, balas
 * persisted:false dan client fallback ke localStorage — event demo tetap jalan.
 * GET  /api/automation/events?run_id=... — baca ulang untuk rekap.
 */

const EventSchema = z.object({
  run_id: z.string().min(1).max(64),
  kind: z.enum(["info", "success", "warning", "error", "demo"]),
  label: z.string().min(1).max(200),
  detail: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  let input: z.infer<typeof EventSchema>;
  try {
    input = EventSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { success: false, error: "Body event tidak valid" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createServerClient();
    const { error } = await supabase
      .from("openclaw_events")
      .insert({
        run_id: input.run_id,
        kind: input.kind,
        label: input.label,
        detail: input.detail ?? null,
      });
    if (error) {
      // Tabel belum ada (migration belum di-apply) atau RLS menolak
      return NextResponse.json({ success: true, persisted: false });
    }
    return NextResponse.json({ success: true, persisted: true });
  } catch {
    return NextResponse.json({ success: true, persisted: false });
  }
}

export async function GET(request: Request) {
  const runId = new URL(request.url).searchParams.get("run_id") || "";
  if (!runId) {
    return NextResponse.json(
      { success: false, error: "Parameter run_id wajib" },
      { status: 400 }
    );
  }
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("openclaw_events")
      .select("kind,label,detail,created_at")
      .eq("run_id", runId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) {
      return NextResponse.json({ success: true, data: [], persisted: false });
    }
    return NextResponse.json({ success: true, data: data ?? [], persisted: true });
  } catch {
    return NextResponse.json({ success: true, data: [], persisted: false });
  }
}
