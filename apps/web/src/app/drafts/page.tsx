import Link from "next/link";
import { ArrowUpRight, Building2, GitBranch, MessageSquare } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  mockExecutors,
  mockProposals,
  type ProposalStatus,
} from "@/lib/mock-proposals";

const statusLabel: Record<ProposalStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  rejected: "Rejected",
};

const statusClassName: Record<ProposalStatus, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  in_review: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  rejected: "border-red-500/30 bg-red-500/10 text-red-200",
};

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <Badge variant="outline" className={statusClassName[status]}>
      {statusLabel[status]}
    </Badge>
  );
}

function getExecutorLabel(executorId: string) {
  return (
    mockExecutors.find((executor) => executor.id === executorId)?.label ??
    executorId
  );
}

export default function DraftsPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              <GitBranch className="size-3" />
              Proposals
            </Badge>
            <Badge variant="outline">{mockExecutors.length} executors</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Proposal Registry
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            A plain list of mocked proposals grouped by executor, version
            history, and recorded reviews.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/" />}>
          <ArrowUpRight className="size-4" />
          Open app
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All proposals</CardTitle>
          <CardDescription>
            Use the app view to filter by executor and inspect the graph.
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/" />}
            >
              Review
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposal</TableHead>
                <TableHead>Executor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockProposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell>
                    <div className="grid gap-1">
                      <span className="font-medium">{proposal.title}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {proposal.id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" />
                      {getExecutorLabel(proposal.executorId)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={proposal.status} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <GitBranch className="size-3" />
                      {proposal.versions.length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <MessageSquare className="size-3" />
                      {proposal.reviews.length}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {proposal.createdAt}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
