"use client";

// React import not required for this component

export default function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-6 w-48 rounded bg-muted/50 animate-pulse" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
