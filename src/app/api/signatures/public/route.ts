import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { z } from "zod";

const publicSignatureSchema = z.object({
  employee_id: z.string().uuid("ID Karyawan tidak valid"),
  phone_number: z.string().min(1, "Nomor telepon wajib diisi"),
  signature: z.string().min(1, "Tanda tangan wajib diisi"),
});

function normalizePhoneNumber(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("62")) {
    digits = "0" + digits.slice(2);
  }
  if (digits.startsWith("8")) {
    digits = "0" + digits;
  }
  return digits;
}

export async function GET() {
  const supabase = createServiceClient();

  try {
    const { data: employeesData, error: empError } = await supabase
      .from("employees")
      .select("id, employee_number, employee_name, department")
      .eq("is_active", true)
      .order("employee_name", { ascending: true });

    if (empError) {
      return NextResponse.json(
        { success: false, error: empError.message },
        { status: 500 }
      );
    }

    const signaturesSet = new Set<string>();
    try {
      const { data: sigData, error: sigError } = await supabase
        .from("signatures")
        .select("employee_id");
      if (!sigError && sigData) {
        sigData.forEach((s: { employee_id: string }) => {
          signaturesSet.add(s.employee_id);
        });
      }
    } catch {
      // Ignore error if table doesn't exist yet
    }

    const mappedData = employeesData?.map((emp) => ({
      id: emp.id,
      employee_number: emp.employee_number,
      employee_name: emp.employee_name,
      department: emp.department,
      has_signature: signaturesSet.has(emp.id),
    })) || [];

    return NextResponse.json({ success: true, data: mappedData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan sistem";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  try {
    const body = await request.json();
    const result = publicSignatureSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { data: emp, error: empError } = await supabase
      .from("employees")
      .select("id, phone_number, employee_name")
      .eq("id", result.data.employee_id)
      .eq("is_active", true)
      .single();

    if (empError || !emp) {
      return NextResponse.json(
        { success: false, error: "Data karyawan tidak ditemukan atau tidak aktif." },
        { status: 404 }
      );
    }

    const normalizedDbPhone = normalizePhoneNumber(emp.phone_number);
    const normalizedInputPhone = normalizePhoneNumber(result.data.phone_number);

    if (normalizedDbPhone !== normalizedInputPhone) {
      return NextResponse.json(
        { success: false, error: "Nomor telepon yang Anda masukkan tidak cocok dengan data karyawan terdaftar." },
        { status: 401 }
      );
    }

    const { error: sigError } = await supabase.from("signatures").upsert(
      {
        employee_id: emp.id,
        signature: result.data.signature,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "employee_id" }
    );

    if (sigError) {
      return NextResponse.json(
        { success: false, error: "Gagal menyimpan tanda tangan ke database: " + sigError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Tanda tangan untuk ${emp.employee_name} berhasil disimpan!`,
      data: {
        employee_id: emp.id,
        employee_name: emp.employee_name,
        signature: result.data.signature,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Terjadi kesalahan sistem";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
