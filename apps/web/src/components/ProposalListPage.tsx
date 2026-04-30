"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  GitBranch,
  GitFork,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { mockDrafts, type Draft } from "@/lib/mock-proposals";

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
      <Badge variant="outline">
        <MessageSquare className="size-3" />
        {draft.reviews.length}
      </Badge>
      <Badge variant="outline">{totals.approved} approved</Badge>
      <Badge variant="outline" className="text-muted-foreground">
        {totals.rejected} rejected
      </Badge>
    </div>
  );
}

export function ProposalListPage() {
  const [query, setQuery] = useState("");

  const proposals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return mockDrafts;

    return mockDrafts.filter((proposal) =>
      [
        proposal.id,
        proposal.executor,
        proposal.proposer,
        proposal.description,
        proposal.previousVersion ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [query]);

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              <GitBranch className="size-3" />
              Proposals
            </Badge>
            <Badge variant="outline">{mockDrafts.length} total</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Proposals
          </h1>
        </div>
        <Button nativeButton={false} render={<Link href="/drafts/new" />}>
          <Plus className="size-4" />
          Create proposal
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All proposals</CardTitle>
          <CardDescription>
            Mocked proposal records by author, executor, timestamp, and reviews.
          </CardDescription>
          <CardAction>
            <div className="relative w-full min-w-[220px] sm:w-[320px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
                placeholder="Proposal, author, executor"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Executor</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead className="w-[180px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell className="min-w-[280px]">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            Proposal #{proposal.id}
                          </span>
                          {proposal.previousVersion ? (
                            <Badge variant="outline">
                              <GitBranch className="size-3" />
                              from #{proposal.previousVersion}
                            </Badge>
                          ) : null}
                        </div>
                        <span className="max-w-[34rem] truncate text-sm text-muted-foreground">
                          {proposal.description || "No description"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortAddress(proposal.proposer)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {shortAddress(proposal.executor)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {proposal.timestamp}
                    </TableCell>
                    <TableCell>
                      <ReviewsBadge draft={proposal} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={<Link href={`/drafts/${proposal.id}`} />}
                        >
                          <ArrowUpRight className="size-3.5" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          nativeButton={false}
                          render={
                            <Link
                              href={`/drafts/new?previousVersion=${proposal.id}`}
                            />
                          }
                        >
                          <GitFork className="size-3.5" />
                          Fork
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
