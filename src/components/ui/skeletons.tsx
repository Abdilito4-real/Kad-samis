import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shared loading placeholders for data pages.
 *
 * Rule of thumb across the app: the page's static chrome (title, subtitle,
 * column headers, action buttons) renders immediately and never disappears
 * behind a spinner — only the parts that come from the network (stat
 * values, table/list rows) swap to these skeletons while a fetch is in
 * flight. That keeps layout stable and lets the user start reading the page
 * before the data arrives, instead of a full-page spinner that hides
 * everything and then pops the whole page in at once.
 */

/** Drop-in replacement for a stat value while it loads — pass as
 * `MetricCard`'s `value` prop so the title/icon stay put. */
export function MetricValueSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-7 w-16 sm:h-8", className)} />;
}

/** Full `MetricCard`-shaped placeholder for the rarer case where even the
 * stat's title/icon depend on data that hasn't arrived yet (e.g. the
 * dashboard doesn't know if it's rendering the org view or the super-admin
 * view until the summary response comes back). Prefer `MetricValueSkeleton`
 * over this whenever the title is already known. */
export function MetricCardSkeleton() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-20" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

/** One placeholder row for the "avatar/icon + two lines + trailing badge"
 * list pattern used by the asset register, facilities list, etc. Render the
 * real column header row above this and N of these below it. */
export function ListRowSkeleton({ withAvatar = false }: { withAvatar?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-4 border-t border-border px-4 py-3.5 first:border-t-0">
      {withAvatar ? <Skeleton className="h-9 w-9 shrink-0 rounded-full" /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
      <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
      <Skeleton className="h-4 w-12 shrink-0" />
    </div>
  );
}

/** N stacked `ListRowSkeleton`s inside the same bordered wrapper the real
 * rows render in, so the swap-in doesn't shift the surrounding card. */
export function ListSkeleton({ rows = 5, withAvatar = false }: { rows?: number; withAvatar?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      {Array.from({ length: rows }).map((_, index) => (
        <ListRowSkeleton key={index} withAvatar={withAvatar} />
      ))}
    </div>
  );
}

/** One placeholder matching a `ResponsiveListRow` — its own bordered card
 * with a title line and a 3-column detail grid underneath. Used by every
 * page built on `ResponsiveList` (inspections, requests, transfers, users,
 * operations, notifications). */
export function ResponsiveListRowSkeleton({ detailCols = 3 }: { detailCols?: 2 | 3 | 4 }) {
  return (
    <div className="min-h-12 space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className={cn("grid grid-cols-1 gap-3", detailCols === 2 ? "sm:grid-cols-2" : detailCols === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
        {Array.from({ length: detailCols }).map((_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** N stacked `ResponsiveListRowSkeleton`s, spaced to match `ResponsiveList`. */
export function ResponsiveListSkeleton({ rows = 4, detailCols = 3 }: { rows?: number; detailCols?: 2 | 3 | 4 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <ResponsiveListRowSkeleton key={index} detailCols={detailCols} />
      ))}
    </div>
  );
}

/** One placeholder table row matching a `<tr>` of plain `<td>` cells. Pass
 * `columns` to match the real table's column count. */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <tr className="border-t border-border">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-3.5">
          <Skeleton className="h-4 w-full max-w-[10rem]" />
        </td>
      ))}
    </tr>
  );
}

/** N stacked `TableRowSkeleton`s — use inside the real `<tbody>` under the
 * real `<thead>` so the header never disappears while rows load. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRowSkeleton key={index} columns={columns} />
      ))}
    </>
  );
}

/** A grid of card-shaped placeholders for card-grid pages (facilities,
 * mdas). Matches `ResponsiveGrid`'s default gap. */
export function CardGridSkeleton({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-border p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}
