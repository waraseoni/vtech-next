export function MechanicsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse max-w-[1600px] mx-auto p-4 md:p-6">
      {/* Header Skeleton */}
      <div className="h-20 rounded-3xl bg-panel-2/60 border border-app p-4 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-40 bg-muted-2/20 rounded" />
          <div className="h-3 w-52 bg-muted-2/15 rounded" />
        </div>
        <div className="h-10 w-36 bg-muted-2/20 rounded-xl" />
      </div>

      {/* Grid of Mechanics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-44 rounded-2xl bg-panel-2/40 border border-app p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted-2/20" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-32 bg-muted-2/20 rounded" />
                <div className="h-3 w-20 bg-muted-2/15 rounded" />
              </div>
            </div>
            <div className="h-3 w-full bg-muted-2/10 rounded mt-4" />
            <div className="h-8 bg-panel/30 rounded-xl mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
