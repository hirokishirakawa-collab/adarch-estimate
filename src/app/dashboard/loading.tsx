export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Greeting skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-zinc-200 rounded-lg" />
        <div className="h-4 w-64 bg-zinc-100 rounded" />
      </div>

      {/* Digest card skeleton */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-100 rounded-xl" />
          <div className="h-5 w-32 bg-zinc-200 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-zinc-100 rounded" />
          <div className="h-4 w-5/6 bg-zinc-100 rounded" />
          <div className="h-4 w-3/4 bg-zinc-100 rounded" />
        </div>
      </div>

      {/* Quick actions skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3"
          >
            <div className="w-8 h-8 bg-zinc-100 rounded-lg" />
            <div className="h-4 w-20 bg-zinc-100 rounded" />
          </div>
        ))}
      </div>

      {/* Secondary content skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-3"
          >
            <div className="h-5 w-28 bg-zinc-200 rounded" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-zinc-100 rounded" />
              <div className="h-3 w-4/5 bg-zinc-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
