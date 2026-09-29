import { notFound } from "next/navigation";
import { getSuperadminUser } from "@/lib/superadmin";
import { UserTable } from "@/components/users/user-table";

export default async function UsersPage() {
  const admin = await getSuperadminUser();
  // Bukan superadmin = halaman tidak ada buat dia (menu juga disembunyikan)
  if (!admin) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">User Login</h1>
      <UserTable />
    </div>
  );
}
