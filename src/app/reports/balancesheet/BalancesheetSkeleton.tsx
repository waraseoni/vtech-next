export function BalancesheetSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-[1600px] mx-auto p-4 md:p-6">
      {/* Header Skeleton */}
      <div className="h-20 rounded-3xl bg-panel-2/60 border border-app p-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-40 bg-muted-2/20 rounded" />
          <div className="h-3 w-56 bg-muted-2/15 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-muted-2/20 rounded-xl" />
          <div className="h-10 w-28 bg-muted-2/20 rounded-xl" />
        </div>
      </div>

      {/* Date Filter & Tabs Skeleton */}
      <div className="h-14 rounded-2xl bg-panel-2/40 border border-app p-2 flex items-center justify-between">
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 w-24 bg-muted-2/20 rounded-xl" />
          ))}
        </div>
        <div className="h-9 w-48 bg-muted-2/20 rounded-xl" />
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-panel-2/40 border border-app p-4 space-y-2">
            <div className="h-3 w-20 bg-muted-2/20 rounded" />
            <div className="h-6 w-28 bg-muted-2/30 rounded" />
          </div>
        ))}
      </div>

      {/* Ledger Table Skeleton */}
      <div className="border border-app rounded-2xl overflow-hidden bg-panel/30">
        <div className="h-12 bg-panel-2/70 border-b border-app" />
        <div className="divide-y divide-app">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 flex items-center px-4 justify-between">
              <div className="flex gap-4 items-center">
                <div className="h-4 w-32 bg-muted-2/20 rounded" />
                <div className="h-4 w-24 bg-muted-2/15 rounded" />
              </div>
              <div className="h-4 w-24 bg-muted-2/20 rounded" />
              <div className="h-5 w-20 bg-emerald-500/10 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
