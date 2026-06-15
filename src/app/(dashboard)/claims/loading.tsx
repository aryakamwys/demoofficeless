import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function ClaimsListLoading() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <Skeleton className="h-10 flex-1 max-w-sm rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
          <Skeleton className="h-10 w-44 rounded-md" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Table Skeleton */}
      <Card>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="border-b px-4 py-3 flex gap-6">
            {[100, 140, 100, 60, 80, 80, 60].map((w, i) => (
              <Skeleton key={i} className="h-4" style={{ width: w }} />
            ))}
          </div>
          {/* Table Rows */}
          {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
            <div key={row} className="border-b px-4 py-4 flex gap-6 items-center">
              {[100, 140, 100, 60, 80, 80, 60].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: w }} />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
