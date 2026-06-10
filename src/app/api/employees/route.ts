import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { employeeSchema } from "@/lib/validations/employee";

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";

  let query = supabase
    .from("employees")
    .select("*")
    .eq("is_active", true)
    .order("employee_name", { ascending: true });

  if (search) {
    query = query.or(
      `employee_name.ilike.%${search}%,employee_number.ilike.%${search}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
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
    .insert(result.data)
    .select()
    .single();

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
