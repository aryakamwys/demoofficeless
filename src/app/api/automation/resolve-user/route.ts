import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/envgate";
import { errorMessage } from "@/lib/utils";

/**
 * GET /api/automation/resolve-user?email=...
 * Tahap "resolve customer": cari user InvGate berdasarkan email.
 * Tidak ketemu = { found: false } — pemanggil harus eksplisit, bukan nebak.
 */
export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get("email") || "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { success: false, error: "Parameter email tidak valid" },
      { status: 400 }
    );
  }
  try {
    const user = await findUserByEmail(email);
    return NextResponse.json({
      success: true,
      data: {
        found: Boolean(user?.id),
        id: user?.id ?? null,
        name: user?.name ?? null,
        email,
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Gagal resolve user InvGate") },
      { status: 502 }
    );
  }
}
