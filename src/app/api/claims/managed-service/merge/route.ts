import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { errorMessage } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { managedClaimId, grabClaimId } = await request.json();

    if (!managedClaimId || !grabClaimId) {
      return NextResponse.json(
        { success: false, error: "Missing required IDs" },
        { status: 400 }
      );
    }

    // Merge atomik di Postgres (027_merge_and_rls.sql): kunci kedua baris,
    // cek status PENDING, tambah amount, SET 'MERGED' — satu transaksi.
    // Versi JS dulu menambah amount dulu lalu gagal di CHECK constraint
    // ('MERGED' belum diizinkan) → amount bengkak permanen tiap retry.
    const { data, error } = await supabase.rpc("merge_managed_claim", {
      p_managed: managedClaimId,
      p_grab: grabClaimId,
    });

    if (error) {
      return NextResponse.json(
        { success: false, error: errorMessage(error, "Internal server error") },
        { status: 500 }
      );
    }

    const result = (data ?? {}) as { success?: boolean; error?: string };

    if (!result.success) {
      if (result.error === "MANAGED_NOT_FOUND") {
        return NextResponse.json(
          { success: false, error: "Klaim managed service tidak ditemukan" },
          { status: 404 }
        );
      }
      if (result.error === "GRAB_NOT_FOUND") {
        return NextResponse.json(
          { success: false, error: "Klaim Grab tidak ditemukan" },
          { status: 404 }
        );
      }
      if (result.error === "GRAB_NOT_PENDING") {
        return NextResponse.json(
          { success: false, error: "Klaim Grab sudah pernah digabungkan" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Gagal menggabungkan klaim" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: "Successfully merged claims" });
  } catch (error: unknown) {
    console.error("Merge error:", error);
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Internal server error") },
      { status: 500 }
    );
  }
}
