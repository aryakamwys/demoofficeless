import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function UploadLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Upload Form Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-md" />
        </CardContent>
      </Card>

      {/* Upload History Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
