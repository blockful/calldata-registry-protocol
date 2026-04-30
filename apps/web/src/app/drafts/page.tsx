import Link from "next/link";
import { ArrowUpRight, GitBranch, ShieldCheck } from "lucide-react";
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
import { mockProposals, type ProposalStatus, type RiskLevel } from "@/lib/mock-proposals";

const statusLabel: Record<ProposalStatus, string> = {
  ready: "Ready",
  "in-review": "In review",
  "needs-changes": "Needs changes",
  executed: "Executed",
};

const statusClassName: Record<ProposalStatus, string> = {
  ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  "in-review": "border-sky-500/30 bg-sky-500/10 text-sky-200",
  "needs-changes": "border-amber-500/30 bg-amber-500/10 text-amber-200",
  executed: "border-violet-500/30 bg-violet-500/10 text-violet-200",
};

const riskClassName: Record<RiskLevel, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  high: "border-red-500/30 bg-red-500/10 text-red-200",
};

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <Badge variant="outline" className={statusClassName[status]}>
      {statusLabel[status]}
    </Badge>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <Badge variant="outline" className={riskClassName[risk]}>
      {risk} risk
    </Badge>
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
              Mock registry
            </Badge>
            <Badge variant="outline">{mockProposals.length} proposals</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Proposal Registry
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Versioned calldata drafts, reviewer state, and execution readiness
            represented as production-shaped mock data.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href="/" />}>
          <ShieldCheck className="size-4" />
          Open review desk
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>
            Proposals are ordered by reviewer attention and execution state.
          </CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/" />}
            >
              <ArrowUpRight className="size-4" />
              Review
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposal</TableHead>
                <TableHead>Org</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockProposals.map((proposal) => {
                const activeVersion =
                  proposal.versions.find(
                    (version) => version.id === proposal.activeVersionId
                  ) ?? proposal.versions[0];

                return (
                  <TableRow key={proposal.id}>
                    <TableCell>
                      <div className="grid gap-1">
                        <span className="font-medium">{proposal.title}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {proposal.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{proposal.org}</TableCell>
                    <TableCell>
                      <StatusBadge status={proposal.status} />
                    </TableCell>
                    <TableCell>
                      <RiskBadge risk={proposal.risk} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {activeVersion.id}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {proposal.updatedAt}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
