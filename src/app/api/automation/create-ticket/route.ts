import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createIncident,
  findUserByEmail,
  getCategoryMap,
  getPriorityMap,
  getRecentTickets,
  getSourceMap,
  getTicket,
  ticketTitle,
} from "@/lib/envgate";
import { errorMessage } from "@/lib/utils";

/**
 * POST /api/automation/create-ticket
 * Buat tiket InvGate sesuai kontrak terverifikasi POST /incident.
 * Sukses HANYA jika InvGate membalas status OK + request_id.
 */

const BodySchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(1).max(8000),
  category_id: z.number().int().positive(),
  priority_id: z.number().int().positive(),
  sender: z.email(),
  force: z.boolean().optional(),
});

export async function POST(request: Request) {
  let input: z.infer<typeof BodySchema>;
  try {
    input = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { success: false, error: "Body tidak valid: title, description, category_id, priority_id, sender wajib" },
      { status: 400 }
    );
  }

  try {
    // ID kategori/prioritas harus benar-benar ada di katalog instance ini
    const [categories, priorities] = await Promise.all([
      getCategoryMap(),
      getPriorityMap(),
    ]);
    if (!categories[input.category_id]) {
      return NextResponse.json(
        { success: false, error: `category_id ${input.category_id} tidak ada di InvGate` },
        { status: 400 }
      );
    }
    if (!priorities[input.priority_id]) {
      return NextResponse.json(
        { success: false, error: `priority_id ${input.priority_id} tidak ada di InvGate` },
        { status: 400 }
      );
    }

    // Cek duplikat: judul identik di tiket terbaru → tolak kecuali force
    if (!input.force) {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const dup = (await getRecentTickets(null, null))
        .filter((t) => norm(ticketTitle(t)) === norm(input.title))
        .slice(0, 3);
      if (dup.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Judul sama persis sudah pernah dibuat — periksa tiket ini atau lanjutkan paksa",
            existing: dup.map((t) => ({
              id: t.id,
              pretty_id: t.pretty_id || `PIM-${t.id}`,
              title: ticketTitle(t),
            })),
          },
          { status: 409 }
        );
      }
    }

    // customer_id/creator_id wajib ID user nyata — cari via email, jangan nebak
    const user = await findUserByEmail(input.sender);
    if (!user?.id) {
      return NextResponse.json(
        {
          success: false,
          error: `Email ${input.sender} tidak ditemukan sebagai user InvGate — customer_id tidak bisa ditentukan. Tiket tidak dibuat.`,
          missing: ["customer_id", "creator_id"],
          preview: {
            title: input.title,
            description: input.description,
            category_id: input.category_id,
            priority_id: input.priority_id,
            type_id: 1,
          },
        },
        { status: 422 }
      );
    }

    // source "Email" dipakai hanya bila benar-benar ada di katalog instance
    const sources = await getSourceMap();
    const emailSource = Object.values(sources).find((s) =>
      /e-?mail/i.test(s.name || "")
    );

    const result = await createIncident({
      title: input.title,
      description: input.description,
      category_id: input.category_id,
      priority_id: input.priority_id,
      type_id: 1, // Incident — sesuai tabel type di developer manual
      creator_id: user.id,
      customer_id: user.id,
      ...(emailSource?.id != null ? { source_id: emailSource.id } : {}),
    });

    if (result.status !== "OK" || !result.request_id) {
      // Gagal nyata dari InvGate — laporkan apa adanya
      return NextResponse.json(
        {
          success: false,
          error: `InvGate menolak pembuatan tiket: ${result.info || result.status || "tanpa keterangan"}`,
        },
        { status: 502 }
      );
    }

    // Konfirmasi ulang: ambil tiket yang baru dibuat untuk pretty_id
    const created = await getTicket(String(result.request_id));
    return NextResponse.json({
      success: true,
      data: {
        id: result.request_id,
        pretty_id: created?.pretty_id || `PIM-${result.request_id}`,
        title: created ? ticketTitle(created) : input.title,
        info: result.info || "",
        verified: Boolean(created),
      },
    });
  } catch (error: unknown) {
    console.error("automation/create-ticket error:", errorMessage(error, "unknown"));
    return NextResponse.json(
      { success: false, error: errorMessage(error, "Gagal membuat tiket di InvGate") },
      { status: 502 }
    );
  }
}
