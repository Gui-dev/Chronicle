export default function MemoryDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="h-5 w-24 animate-pulse rounded-full bg-card" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 animate-pulse rounded-lg bg-card" />
          <div className="h-9 w-24 animate-pulse rounded-lg bg-card" />
        </div>
      </div>
      <div className="mb-6 h-4 w-1/2 animate-pulse rounded bg-card" />
      <div className="mb-6 h-9 w-2/3 animate-pulse rounded-lg bg-card" />
      <div className="mb-8 h-24 w-full animate-pulse rounded-xl bg-card" />
      <div className="h-64 w-full animate-pulse rounded-xl bg-card" />
    </div>
  )
}
