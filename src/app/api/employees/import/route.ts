import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import Papa from "papaparse";

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { success: false, error: "File tidak ditemukan" },
      { status: 400 }
    );
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      { success: false, error: "Format CSV tidak valid" },
      { status: 400 }
    );
  }

  const employees = parsed.data
    .filter(
      (row) =>
        row.employee_number &&
        row.employee_name &&
        row.phone_number
    )
    .map((row) => ({
      employee_number: row.employee_number.trim(),
      employee_name: row.employee_name.trim(),
      department: row.department?.trim() || "",
      phone_number: row.phone_number.trim(),
      is_active: true,
    }));

  if (employees.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Tidak ada data valid. Pastikan kolom: employee_number, employee_name, phone_number",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("employees")
    .upsert(employees, {
      onConflict: "employee_number",
      ignoreDuplicates: false,
    });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { count: employees.length },
  });
}
