import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { z } from "zod";

const publicRegistrationSchema = z.object({
  employee_number: z.string().min(1, "NIP wajib diisi"),
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

    const { employee_number, employee_name, department, phone_number, signature } = result.data;

    // 1. Cek apakah employee sudah ada berdasarkan NIP
    let employeeId: string;
    
    const { data: existingEmp, error: checkError } = await supabase
      .from("employees")
      .select("id")
      .eq("employee_number", employee_number)
      .single();

    if (existingEmp && !checkError) {
      // Jika ada, gunakan ID-nya dan update datanya
      employeeId = existingEmp.id;
      const { error: updateError } = await supabase
        .from("employees")
        .update({
          employee_name,
          department,
          phone_number,
        })
        .eq("id", employeeId);
        
      if (updateError) {
        return NextResponse.json(
          { success: false, error: "Gagal memperbarui data karyawan: " + updateError.message },
          { status: 500 }
        );
      }
    } else {
      // Jika belum ada, buat employee baru
      const { data: newEmp, error: insertError } = await supabase
        .from("employees")
        .insert({
          employee_number,
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
    }

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
