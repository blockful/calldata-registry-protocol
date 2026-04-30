"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

type SortKey = "id" | "author" | "executor" | "timestamp" | "reviews";
type SortDirection = "asc" | "desc";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

const sortKeys: SortKey[] = [
  "id",
  "author",
  "executor",
  "timestamp",
  "reviews",
];
const defaultSort: SortState = {
  key: "timestamp",
  direction: "desc",
};

function isSortKey(value: string | undefined): value is SortKey {
  return sortKeys.includes(value as SortKey);
}

function normalizeSort(
  sortKey: string | undefined,
  sortDirection: string | undefined
): SortState {
  return {
    key: isSortKey(sortKey) ? sortKey : defaultSort.key,
    direction:
      sortDirection === "asc" || sortDirection === "desc"
        ? sortDirection
        : defaultSort.direction,
  };
}

function shortAddress(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
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
    case "author":
      result = first.proposer.localeCompare(second.proposer);
      break;
    case "executor":
      result = first.executor.localeCompare(second.executor);
      break;
    case "timestamp":
      result = getTimestampValue(first) - getTimestampValue(second);
      break;
    case "reviews": {
      const firstTotals = reviewTotals(first);
      const secondTotals = reviewTotals(second);
      result =
        firstTotals.approved - secondTotals.approved ||
        firstTotals.rejected - secondTotals.rejected ||
        first.reviews.length - second.reviews.length;
      break;
    }
  }

  return result * multiplier;
}

function SortableHead({
  label,
  sortKey,
  sort,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
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
        href={`/?sort=${sortKey}&direction=${nextDirection}`}
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

export function ProposalListPage({
  sortKey,
  sortDirection,
}: {
  sortKey?: string;
  sortDirection?: string;
}) {
  const [query, setQuery] = useState("");
  const sort = useMemo(
    () => normalizeSort(sortKey, sortDirection),
    [sortKey, sortDirection]
  );

  const calldatas = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = !normalizedQuery
      ? mockDrafts
      : mockDrafts.filter((calldata) =>
          [
            calldata.id,
            calldata.executor,
            calldata.proposer,
            calldata.description,
            calldata.previousVersion ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery)
        );

    return [...filtered].sort((first, second) =>
      compareDrafts(first, second, sort)
    );
  }, [query, sort]);

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              <GitBranch className="size-3" />
              Calldata
            </Badge>
            <Badge variant="outline">{mockDrafts.length} total</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Calldata
          </h1>
        </div>
        <Button nativeButton={false} render={<Link href="/drafts/new" />}>
          <Plus className="size-4" />
          Create calldata
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All calldata</CardTitle>
          <CardDescription>
            Mocked calldata records by author, executor, timestamp, and reviews.
          </CardDescription>
          <CardAction>
            <div className="relative w-full min-w-[220px] sm:w-[320px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
                placeholder="Calldata, author, executor"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHead
                    label="Calldata"
                    sortKey="id"
                    sort={sort}
                  />
                  <SortableHead
                    label="Author"
                    sortKey="author"
                    sort={sort}
                  />
                  <SortableHead
                    label="Executor"
                    sortKey="executor"
                    sort={sort}
                  />
                  <SortableHead
                    label="Timestamp"
                    sortKey="timestamp"
                    sort={sort}
                  />
                  <SortableHead
                    label="Reviews"
                    sortKey="reviews"
                    sort={sort}
                  />
                  <TableHead className="w-[180px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calldatas.map((calldata) => (
                  <TableRow key={calldata.id}>
                    <TableCell className="min-w-[280px]">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            Calldata #{calldata.id}
                          </span>
                          {calldata.previousVersion ? (
                            <Badge variant="outline">
                              <GitBranch className="size-3" />
                              from #{calldata.previousVersion}
                            </Badge>
                          ) : null}
                        </div>
                        <span className="max-w-[34rem] truncate text-sm text-muted-foreground">
                          {calldata.description || "No description"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortAddress(calldata.proposer)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortAddress(calldata.executor)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {calldata.timestamp}
                    </TableCell>
                    <TableCell>
                      <ReviewsBadge draft={calldata} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={
                            <Link
                              href={`/drafts/new?previousVersion=${calldata.id}`}
                            />
                          }
                        >
                          <GitFork className="size-3.5" />
                          Fork
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/drafts/${calldata.id}`} />}
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
        </CardContent>
      </Card>
    </div>
  );
}
