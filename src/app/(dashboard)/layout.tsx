import { AppShell } from "@/components/layout/app-shell";
import { ConfirmDialogHost } from "@/components/confirm-dialog";
import { getSuperadminUser } from "@/lib/superadmin";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Flag superadmin server-side — env SUPERADMIN_EMAILS tidak pernah kirim ke client
  const admin = await getSuperadminUser();

  return (
    <AppShell isSuperadmin={!!admin}>
      {children}
      <ConfirmDialogHost />
    </AppShell>
  );
}
