import { NextRequest, NextResponse, after } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { sendClaimToEmployee } from "@/lib/wa-send";

// Antrean blast di MEMORI proses — jalan di background (after()) setelah
// response terkirim; halaman web hanya polling GET. Tab browser boleh
// ditutup, antrean tetap jalan di VPS.
// ponytail: server restart di tengah blast = sisa klaim tetap PENDING dan
// bisa diblast ulang; pindah ke tabel jobs kalau butuh riwayat permanen.
type BulkItem = {
  claim_id: string;
  employee_name: string;
  period: string;
  total_amount: number;
  state: "waiting" | "sending" | "ok" | "fail";
  error?: string;
};

type BulkJob = {
  started_at: string;
  items: BulkItem[];
  running: boolean;
  stopped: boolean;
};

let job: BulkJob | null = null;

async function runJob() {
  if (!job) return;
  for (const item of job.items) {
    if (job.stopped) break;
    item.state = "sending";
    const r = await sendClaimToEmployee(item.claim_id);
    item.state = r.ok ? "ok" : "fail";
    item.error = r.ok ? undefined : r.error;
  }
  if (job) job.running = false;
}

function jobSummary() {
  if (!job) return null;
  return {
    running: job.running,
    stopped: job.stopped,
    started_at: job.started_at,
    total: job.items.length,
    done: job.items.filter((i) => i.state === "ok" || i.state === "fail").length,
    items: job.items,
  };
}

export async function GET() {
  return NextResponse.json({ success: true, job: jobSummary() });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body?.action === "stop") {
      if (job) job.stopped = true;
      return NextResponse.json({ success: true, job: jobSummary() });
    }

    if (job?.running) {
      return NextResponse.json(
        { success: false, error: "Masih ada blast yang sedang berjalan — pantau dulu prosesnya." },
        { status: 409 }
      );
    }

    const ids: string[] = Array.isArray(body?.claim_ids) ? body.claim_ids.filter((x: unknown) => typeof x === "string") : [];
    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada klaim yang dipilih" },
        { status: 400 }
      );
    }

    // Validasi ulang dari data terkini: hanya klaim PENDING milik karyawan
    // yang punya nomor WA — kondisi bisa berubah sejak halaman dimuat.
    const supabase = await createServerClient();
    const { data } = await supabase
      .from("claims")
      .select(`
        id,
        period,
        total_amount,
        status,
        employee:employees!claims_employee_id_fkey(employee_name, phone_number)
      `)
      .in("id", ids);

    const items: BulkItem[] = (data || [])
      .map((c) => {
        // Join satu-baris kadang di-return sebagai array oleh client generik
        const emp = Array.isArray(c.employee) ? c.employee[0] : c.employee;
        return { c, emp };
      })
      .filter(({ c, emp }) => c.status === "PENDING" && emp?.phone_number)
      .map(({ c, emp }) => ({
        claim_id: c.id,
        employee_name: emp?.employee_name || "Karyawan",
        period: c.period,
        total_amount: c.total_amount,
        state: "waiting" as const,
      }));

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada klaim yang siap dikirim (semua sudah terkirim atau belum ter-map)" },
        { status: 400 }
      );
    }

    job = {
      started_at: new Date().toISOString(),
      items,
      running: true,
      stopped: false,
    };
    after(runJob);

    return NextResponse.json({ success: true, job: jobSummary() });
  } catch (error) {
    console.error("Unhandled error in /api/whatsapp/bulk:", error);
    return NextResponse.json({ success: false, error: "Terjadi kesalahan sistem" }, { status: 500 });
  }
}
