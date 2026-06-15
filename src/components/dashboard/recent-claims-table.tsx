import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/claims/status-badge";
import { ClaimWithEmployee } from "@/types";
import dayjs from "dayjs";

interface RecentClaimsTableProps {
  claims: ClaimWithEmployee[];
}

export function RecentClaimsTable({ claims }: RecentClaimsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Claims</CardTitle>
      </CardHeader>
      <CardContent>
        {claims.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Belum ada data claims.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell>
                    <Link
                      href={`/claims/${claim.id}`}
                      className="font-medium hover:underline"
                    >
                      {claim.employee?.employee_name || "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    Rp{claim.total_amount.toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={claim.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dayjs(claim.updated_at).format("DD MMM YYYY")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
