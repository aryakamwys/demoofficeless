import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";
import { getSuperadminUser, isSuperadminEmail } from "@/lib/superadmin";
import { resetPasswordSchema } from "@/lib/validations/user";

const forbidden = () =>
  NextResponse.json(
    { success: false, error: "Khusus superadmin" },
    { status: 403 }
  );

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSuperadminUser();
  if (!admin) return forbidden();

  const { id } = await params;
  if (id === admin.id) {
    return NextResponse.json(
      { success: false, error: "Tidak bisa menghapus akun sendiri" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const {
    data: { user },
    error: fetchError,
  } = await supabase.auth.admin.getUserById(id);
  if (fetchError || !user) {
    return NextResponse.json(
      { success: false, error: "User tidak ditemukan" },
      { status: 404 }
    );
  }
  if (isSuperadminEmail(user.email)) {
    return NextResponse.json(
      { success: false, error: "Tidak bisa menghapus superadmin lain" },
      { status: 400 }
    );
  }

  // uploads.uploaded_by punya FK ke auth.users tanpa cascade — user yang
  // pernah upload akan gagal dihapus; pesan error diteruskan apa adanya.
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getSuperadminUser())) return forbidden();

  const { id } = await params;
  const body = await request.json();

  const result = resetPasswordSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { success: false, error: result.error.issues[0].message },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase.auth.admin.updateUserById(id, {
    password: result.data.password,
  });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
