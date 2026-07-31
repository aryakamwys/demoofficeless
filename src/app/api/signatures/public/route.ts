import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { z } from "zod";

const publicRegistrationSchema = z.object({
  employee_name: z.string().min(1, "Nama wajib diisi"),
  department: z.string().optional(),
  phone_number: z.string().min(1, "Nomor telepon wajib diisi"),
  signature: z.string().min(1, "Tanda tangan wajib diisi"),
});

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  try {
    const body = await request.json();
    const result = publicRegistrationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0].message },
        { status: 400 }
      );
    }

    const { employee_name, department, phone_number, signature } = result.data;

    // 1. Cek apakah employee sudah ada berdasarkan Nomor Telepon atau Nama
    let employeeId: string;
    
    const { data: existingEmp, error: checkError } = await supabase
      .from("employees")
      .select("id, phone_number, employee_name")
      .or(`phone_number.eq.${phone_number},employee_name.eq.${employee_name}`);

    if (existingEmp && existingEmp.length > 0) {
      // Cek field mana yang duplikat untuk pesan error yang lebih spesifik
      const match = existingEmp[0];
      if (match.phone_number === phone_number) {
        return NextResponse.json(
          { success: false, error: "Nomor WhatsApp ini sudah pernah didaftarkan." },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { success: false, error: "Nama ini sudah pernah didaftarkan." },
          { status: 400 }
        );
      }
    }

    // Jika belum ada, buat employee baru
    const generatedEmpNumber = `EMP-${Math.floor(Date.now() / 1000)}`; // Generate random NIP
    
    const { data: newEmp, error: insertError } = await supabase
      .from("employees")
      .insert({
        employee_number: generatedEmpNumber,
        employee_name,
        department,
        phone_number,
        role: "EMPLOYEE",
        is_active: true
      })
      .select("id")
      .single();

    if (insertError || !newEmp) {
      return NextResponse.json(
        { success: false, error: "Gagal mendaftarkan karyawan baru: " + (insertError?.message || "") },
        { status: 500 }
      );
    }
    employeeId = newEmp.id;

    // 2. Upsert signature
    const { error: sigError } = await supabase.from("signatures").upsert(
      {
        employee_id: employeeId,
        signature: signature,
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
      message: `Data dan tanda tangan untuk ${employee_name} berhasil disimpan!`,
      data: {
        employee_id: employeeId,
        employee_name,
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
