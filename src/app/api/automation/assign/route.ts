import { NextResponse } from "next/server";
import { z } from "zod";
import { assignEngineer, type EngineerRow } from "@/lib/assignment";
import { findUserByEmail } from "@/lib/envgate";

/**
 * POST /api/automation/assign
 * Assignment engineer deterministik dari data CSV yang sudah diparse client.
 * Email engineer di-resolve ke ID agen InvGate ASLI bila ketemu; tidak
 * pernah mengarang ID. Gagal resolve → null (dicatat lokal saja).
 */

const EngineerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  skills: z.array(z.string()),
  sites: z.array(z.string()),
  available: z.boolean(),
  active_tickets: z.number().int().min(0),
});

const BodySchema = z.object({
  engineers: z.array(EngineerSchema).max(200),
  site: z.string(),
  required_skills: z.array(z.string()).max(20),
  customer: z.string(),
});

export async function POST(request: Request) {
  let input: z.infer<typeof BodySchema>;
  try {
    input = BodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { success: false, error: "Body tidak valid: engineers, site, required_skills, customer" },
      { status: 400 }
    );
  }

  // Resolve email → ID agen InvGate (best-effort, gagal = tetap null)
  const resolved: EngineerRow[] = await Promise.all(
    input.engineers.map(async (e) => {
      const user = await findUserByEmail(e.email).catch(() => null);
      return { ...e, invgate_agent_id: user?.id != null ? Number(user.id) : null };
    })
  );

  const result = assignEngineer(resolved, {
    site: input.site,
    required_skills: input.required_skills,
    customer: input.customer,
  });

  return NextResponse.json({ success: true, data: result });
}
