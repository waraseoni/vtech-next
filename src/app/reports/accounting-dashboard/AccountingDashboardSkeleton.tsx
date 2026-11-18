export function AccountingDashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse max-w-[1600px] mx-auto p-4 md:p-6">
      {/* Header Skeleton */}
      <div className="h-20 rounded-3xl bg-panel-2/60 border border-app p-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-44 bg-muted-2/20 rounded" />
          <div className="h-3 w-56 bg-muted-2/15 rounded" />
        </div>
        <div className="h-10 w-36 bg-muted-2/20 rounded-xl" />
      </div>

      {/* Date Filter Bar */}
      <div className="h-14 rounded-2xl bg-panel-2/40 border border-app p-3 flex items-center justify-between">
        <div className="h-8 w-64 bg-muted-2/20 rounded-xl" />
        <div className="h-8 w-24 bg-muted-2/20 rounded-xl" />
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-panel-2/40 border border-app p-4 space-y-2">
            <div className="h-3 w-20 bg-muted-2/20 rounded" />
            <div className="h-7 w-32 bg-muted-2/30 rounded" />
          </div>
        ))}
      </div>

      {/* Chart & Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-2xl bg-panel-2/40 border border-app p-4 space-y-3">
          <div className="h-4 w-36 bg-muted-2/20 rounded" />
          <div className="h-44 bg-panel/30 rounded-xl" />
        </div>
        <div className="h-64 rounded-2xl bg-panel-2/40 border border-app p-4 space-y-3">
          <div className="h-4 w-36 bg-muted-2/20 rounded" />
          <div className="h-44 bg-panel/30 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
