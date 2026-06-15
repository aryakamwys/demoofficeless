import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function EmployeesLoading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 flex-1 max-w-sm rounded-md" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="border-b px-4 py-3 flex gap-6">
            {[60, 140, 100, 120, 80, 60].map((w, i) => (
              <Skeleton key={i} className="h-4" style={{ width: w }} />
            ))}
          </div>
          {/* Rows */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <div key={row} className="border-b px-4 py-4 flex gap-6 items-center">
              {[60, 140, 100, 120, 80, 60].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: w }} />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
