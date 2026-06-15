import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ClaimDetailLoading() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36 rounded-md" />
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>

      {/* HR Info Banner */}
      <Skeleton className="h-24 w-full rounded-lg" />

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i} className="shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b pb-4">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Skeleton */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="border-b pb-4">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="p-0">
          {/* Table Header */}
          <div className="bg-slate-50 border-b px-4 py-3 flex gap-4">
            {[80, 120, 90, 70, 100, 90, 140, 160, 160].map((w, i) => (
              <Skeleton key={i} className="h-4" style={{ width: w }} />
            ))}
          </div>
          {/* Table Rows */}
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="border-b px-4 py-4 flex gap-4 items-start">
              {[80, 120, 90, 70, 100, 90, 140, 160, 160].map((w, i) => (
                <Skeleton key={i} className="h-4" style={{ width: w }} />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
