import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { employeeSchema } from "@/lib/validations/employee";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    .update({
      employee_name: result.data.employee_name,
      department: result.data.department,
      phone_number: result.data.phone_number,
      role: result.data.role,
      manager_id: result.data.manager_id || null,
      hr_id: result.data.hr_id || null
    })
    .eq("id", id)
    .select()
    .single();

  if (data && result.data.signature !== undefined) {
    if (result.data.signature) {
      await supabase.from("signatures").upsert({
        employee_id: data.id,
        signature: result.data.signature,
        updated_at: new Date().toISOString()
      });
    } else if (result.data.signature === null) {
      // If signature is explicitly set to null, delete it
      await supabase.from("signatures").delete().eq("employee_id", data.id);
    }
  }

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { error } = await supabase
    .from("employees")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
