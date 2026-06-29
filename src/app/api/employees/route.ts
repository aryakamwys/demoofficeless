import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { employeeSchema } from "@/lib/validations/employee";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const role = searchParams.get("role") || "";

  let query = supabase
    .from("employees")
    .select("*, signatures(signature)")
    .eq("is_active", true)
    .order("employee_name", { ascending: true });

  if (search) {
    query = query.or(
      `employee_name.ilike.%${search}%,employee_number.ilike.%${search}%`
    );
  }

  if (role) {
    query = query.eq("role", role);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const mappedData = data?.map((emp: any) => ({
    ...emp,
    signature: emp.signatures?.[0]?.signature || emp.signatures?.signature || null,
    signatures: undefined
  }));

  return NextResponse.json({ success: true, data: mappedData });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const body = await request.json();

  const result = employeeSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("employees")
    .insert({
      employee_number: result.data.employee_number,
      employee_name: result.data.employee_name,
      department: result.data.department,
      phone_number: result.data.phone_number,
      role: result.data.role,
      manager_id: result.data.manager_id || null,
      hr_id: result.data.hr_id || null
    })
    .select()
    .single();

  if (data && result.data.signature) {
    await supabase.from("signatures").upsert({
      employee_id: data.id,
      signature: result.data.signature,
      updated_at: new Date().toISOString()
    });
  }

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { success: false, error: "Employee number sudah digunakan" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
