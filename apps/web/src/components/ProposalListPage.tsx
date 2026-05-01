"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowUpDown,
  CheckCircle2,
  GitBranch,
  GitFork,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { mockDrafts, type Draft } from "@/lib/mock-proposals";

type SortKey = "id" | "timestamp";
type SortDirection = "asc" | "desc";
type ReviewFilter = "all" | "approved" | "rejected" | "unreviewed";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type ListParams = {
  q?: string;
  author?: string;
  executor?: string;
  review?: string;
  sortKey?: string;
  sortDirection?: string;
  page?: string;
  pageSize?: string;
};

type NormalizedParams = {
  query: string;
  author: string;
  executor: string;
  review: ReviewFilter;
  sort: SortState;
  page: number;
  pageSize: number;
};

const sortKeys: SortKey[] = ["id", "timestamp"];
const reviewFilters: ReviewFilter[] = [
  "all",
  "approved",
  "rejected",
  "unreviewed",
];
const pageSizeOptions = [10, 25, 50];
const defaultSort: SortState = {
  key: "timestamp",
  direction: "desc",
};

function isSortKey(value: string | undefined): value is SortKey {
  return sortKeys.includes(value as SortKey);
}

function isReviewFilter(value: string | undefined): value is ReviewFilter {
  return reviewFilters.includes(value as ReviewFilter);
}

function normalizeParams(params: ListParams): NormalizedParams {
  const pageSizeValue = Number(params.pageSize);
  const pageValue = Number(params.page);

  return {
    query: params.q?.trim() ?? "",
    author: params.author?.trim() ?? "",
    executor: params.executor?.trim() ?? "",
    review: isReviewFilter(params.review) ? params.review : "all",
    sort: {
      key: isSortKey(params.sortKey) ? params.sortKey : defaultSort.key,
      direction:
        params.sortDirection === "asc" || params.sortDirection === "desc"
          ? params.sortDirection
          : defaultSort.direction,
    },
    page: Number.isFinite(pageValue) && pageValue > 0 ? Math.floor(pageValue) : 1,
    pageSize: pageSizeOptions.includes(pageSizeValue) ? pageSizeValue : 10,
  };
}

function shortAddress(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function draftPath(draft: Draft) {
  return `/${encodeURIComponent(draft.executor.toLowerCase())}/draft/${encodeURIComponent(draft.id)}`;
}

function forkPath(draft: Draft) {
  return `/new?previousVersion=${encodeURIComponent(draft.id)}`;
}

function reviewTotals(draft: Draft) {
  return draft.reviews.reduce(
    (totals, review) => ({
      approved: totals.approved + (review.decision === "approved" ? 1 : 0),
      rejected: totals.rejected + (review.decision === "rejected" ? 1 : 0),
    }),
    { approved: 0, rejected: 0 }
  );
}

function ReviewsBadge({ draft }: { draft: Draft }) {
  const totals = reviewTotals(draft);

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline" aria-label={`${totals.approved} approved`}>
        <CheckCircle2 className="size-3" />
        {totals.approved}
      </Badge>
      <Badge
        variant="outline"
        className="text-muted-foreground"
        aria-label={`${totals.rejected} rejected`}
      >
        <XCircle className="size-3" />
        {totals.rejected}
      </Badge>
    </div>
  );
}

function getTimestampValue(draft: Draft) {
  const value = Date.parse(draft.timestamp);
  return Number.isFinite(value) ? value : 0;
}

function compareDrafts(first: Draft, second: Draft, sort: SortState) {
  const multiplier = sort.direction === "asc" ? 1 : -1;
  let result = 0;

  switch (sort.key) {
    case "id": {
      const firstId = Number(first.id);
      const secondId = Number(second.id);
      result =
        Number.isFinite(firstId) && Number.isFinite(secondId)
          ? firstId - secondId
          : first.id.localeCompare(second.id);
      break;
    }
    case "timestamp":
      result = getTimestampValue(first) - getTimestampValue(second);
      break;
  }

  return result * multiplier;
}

function matchesReviewFilter(draft: Draft, review: ReviewFilter) {
  const totals = reviewTotals(draft);

  switch (review) {
    case "approved":
      return totals.approved > 0;
    case "rejected":
      return totals.rejected > 0;
    case "unreviewed":
      return draft.reviews.length === 0;
    case "all":
      return true;
  }
}

function SortableHead({
  label,
  sortKey,
  sort,
  getHref,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  getHref: (updates: Partial<ListParams>) => string;
}) {
  const isActive = sort.key === sortKey;
  const Icon = !isActive
    ? ArrowUpDown
    : sort.direction === "asc"
      ? ArrowUp
      : ArrowDown;
  const nextDirection: SortDirection =
    isActive && sort.direction === "asc" ? "desc" : "asc";

  return (
    <TableHead
      aria-sort={
        isActive
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
    >
      <Link
        href={getHref({
          sortKey,
          sortDirection: nextDirection,
          page: "1",
        })}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 h-7 px-2 text-xs",
          isActive && "text-foreground"
        )}
      >
        {label}
        <Icon className="size-3.5" />
      </Link>
    </TableHead>
  );
}

function getReviewFilterLabel(review: ReviewFilter) {
  switch (review) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "unreviewed":
      return "No reviews";
    case "all":
      return "All";
  }
}

export function ProposalListPage({
  q,
  author,
  executor,
  review,
  sortKey,
  sortDirection,
  page,
  pageSize,
}: {
  q?: string;
  author?: string;
  executor?: string;
  review?: string;
  sortKey?: string;
  sortDirection?: string;
  page?: string;
  pageSize?: string;
}) {
  const params = useMemo(
    () =>
      normalizeParams({
        q,
        author,
        executor,
        review,
        sortKey,
        sortDirection,
        page,
        pageSize,
      }),
    [q, author, executor, review, sortKey, sortDirection, page, pageSize]
  );

  function getHref(updates: Partial<ListParams>) {
    const next = new URLSearchParams();
    const values: ListParams = {
      q: params.query,
      author: params.author,
      executor: params.executor,
      review: params.review === "all" ? undefined : params.review,
      sortKey: params.sort.key,
      sortDirection: params.sort.direction,
      page: String(params.page),
      pageSize: String(params.pageSize),
      ...updates,
    };

    for (const [key, value] of Object.entries(values)) {
      if (!value || (key === "page" && value === "1")) continue;
      if (key === "pageSize" && value === "10") continue;
      if (key === "sortKey" && value === defaultSort.key) continue;
      if (key === "sortDirection" && value === defaultSort.direction) continue;
      next.set(key === "sortKey" ? "sort" : key === "sortDirection" ? "direction" : key, value);
    }

    const queryString = next.toString();
    return queryString ? `/?${queryString}` : "/";
  }

  const filteredEntries = useMemo(() => {
    const normalizedQuery = params.query.toLowerCase();
    const normalizedAuthor = params.author.toLowerCase();
    const normalizedExecutor = params.executor.toLowerCase();

    const filtered = !normalizedQuery
      ? mockDrafts
      : mockDrafts.filter((entry) =>
          [
            entry.id,
            entry.executor,
            entry.proposer,
            entry.description,
            entry.previousVersion ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        );

    return filtered
      .filter((entry) =>
        normalizedAuthor
          ? entry.proposer.toLowerCase().includes(normalizedAuthor)
          : true
      )
      .filter((entry) =>
        normalizedExecutor
          ? entry.executor.toLowerCase().includes(normalizedExecutor)
          : true
      )
      .filter((entry) => matchesReviewFilter(entry, params.review))
      .sort((first, second) => compareDrafts(first, second, params.sort));
  }, [params]);

  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / params.pageSize));
  const currentPage = Math.min(params.page, pageCount);
  const startIndex = (currentPage - 1) * params.pageSize;
  const visibleEntries = filteredEntries.slice(
    startIndex,
    startIndex + params.pageSize
  );
  const firstVisible = filteredEntries.length === 0 ? 0 : startIndex + 1;
  const lastVisible = Math.min(startIndex + params.pageSize, filteredEntries.length);
  const hasFilters =
    params.query.length > 0 ||
    params.author.length > 0 ||
    params.executor.length > 0 ||
    params.review !== "all";

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Registry entries</CardTitle>
          <CardDescription>
            Browse submitted records by author, executor, review outcome, and timestamp.
          </CardDescription>
          <CardAction>
            <Button nativeButton={false} render={<Link href="/new" />}>
              <Plus className="size-4" />
              New calldata
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action="/"
            className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(180px,240px)_minmax(180px,240px)_auto]"
          >
            <input type="hidden" name="sort" value={params.sort.key} />
            <input type="hidden" name="direction" value={params.sort.direction} />
            <input type="hidden" name="pageSize" value={params.pageSize} />
            <input type="hidden" name="page" value="1" />
            {params.review !== "all" ? (
              <input type="hidden" name="review" value={params.review} />
            ) : null}
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={params.query}
                className="pl-8"
                placeholder="Search ID, author, executor, description"
              />
            </div>
            <Input
              name="author"
              defaultValue={params.author}
              className="font-mono"
              placeholder="Author"
            />
            <Input
              name="executor"
              defaultValue={params.executor}
              className="font-mono"
              placeholder="Executor"
            />
            <div className="flex gap-2">
              <Button type="submit" variant="outline">
                Apply
              </Button>
              {hasFilters ? (
                <Button
                  variant="ghost"
                  nativeButton={false}
                  render={<Link href={getHref({ q: "", author: "", executor: "", review: "", page: "1" })} />}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {reviewFilters.map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={params.review === filter ? "default" : "outline"}
                  nativeButton={false}
                  render={
                    <Link
                      href={getHref({
                        review: filter === "all" ? "" : filter,
                        page: "1",
                      })}
                    />
                  }
                >
                  {getReviewFilterLabel(filter)}
                </Button>
              ))}
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {firstVisible}-{lastVisible} of {filteredEntries.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Entry"
                    sortKey="id"
                    sort={params.sort}
                    getHref={getHref}
                  />
                  <TableHead>Author</TableHead>
                  <TableHead>Executor</TableHead>
                  <SortableHead
                    label="Updated"
                    sortKey="timestamp"
                    sort={params.sort}
                    getHref={getHref}
                  />
                  <TableHead>Reviews</TableHead>
                  <TableHead className="w-[180px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="min-w-[280px]">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            #{entry.id}
                          </span>
                          {entry.previousVersion ? (
                            <Badge variant="outline">
                              <GitBranch className="size-3" />
                              from #{entry.previousVersion}
                            </Badge>
                          ) : null}
                        </div>
                        <span className="max-w-[34rem] truncate text-sm text-muted-foreground">
                          {entry.description || "No description"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortAddress(entry.proposer)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortAddress(entry.executor)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {entry.timestamp}
                    </TableCell>
                    <TableCell>
                      <ReviewsBadge draft={entry} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={
                            <Link href={forkPath(entry)} />
                          }
                        >
                          <GitFork className="size-3.5" />
                          Fork
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={draftPath(entry)} />}
                        >
                          <ArrowUpRight className="size-3.5" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Rows</span>
              {pageSizeOptions.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={params.pageSize === option ? "default" : "outline"}
                  nativeButton={false}
                  render={
                    <Link href={getHref({ pageSize: String(option), page: "1" })} />
                  }
                >
                  {option}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                nativeButton={currentPage > 1 ? false : undefined}
                render={
                  currentPage > 1
                    ? <Link href={getHref({ page: String(currentPage - 1) })} />
                    : undefined
                }
              >
                Previous
              </Button>
              <span className="min-w-20 text-center text-sm text-muted-foreground">
                {currentPage} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pageCount}
                nativeButton={currentPage < pageCount ? false : undefined}
                render={
                  currentPage < pageCount
                    ? <Link href={getHref({ page: String(currentPage + 1) })} />
                    : undefined
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
