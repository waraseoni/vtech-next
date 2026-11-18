export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="h-28 rounded-2xl bg-panel-2/60 border border-app" />

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-panel-2/40 border border-app p-4 space-y-2">
            <div className="h-3 w-16 bg-muted-2/20 rounded" />
            <div className="h-6 w-24 bg-muted-2/30 rounded" />
          </div>
        ))}
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-panel-2/40 border border-app p-4 space-y-3">
          <div className="h-4 w-32 bg-muted-2/20 rounded" />
          <div className="h-52 bg-panel/30 rounded-xl" />
        </div>
        <div className="h-72 rounded-2xl bg-panel-2/40 border border-app p-4 space-y-3">
          <div className="h-4 w-28 bg-muted-2/20 rounded" />
          <div className="h-52 bg-panel/30 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
