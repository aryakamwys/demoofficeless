import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getSuperadminUser, isSuperadminEmail } from "@/lib/superadmin";
import { createUserSchema } from "@/lib/validations/user";

const forbidden = () =>
  NextResponse.json(
    { success: false, error: "Khusus superadmin" },
    { status: 403 }
  );

export async function GET() {
  if (!(await getSuperadminUser())) return forbidden();
  const supabase = createServiceClient();

  // ponytail: satu halaman 1000 user — cukup untuk skala internal; paginate kalau melebihi
  const { data, error } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at,
    is_superadmin: isSuperadminEmail(u.email),
  }));

  return NextResponse.json({ success: true, data: users });
}

export async function POST(request: NextRequest) {
  if (!(await getSuperadminUser())) return forbidden();
  const body = await request.json();

  const result = createUserSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.admin.createUser({
    email: result.data.email,
    password: result.data.password,
    email_confirm: true,
  });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { id: data.user?.id, email: data.user?.email },
  });
}
