"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  GitBranch,
  History,
  Network,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  mockProposals,
  type CalldataAction,
  type Proposal,
  type ProposalStatus,
  type ProposalVersion,
  type ReviewCheck,
  type RiskLevel,
} from "@/lib/mock-proposals";

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

function CheckStateIcon({ state }: { state: ReviewCheck["state"] }) {
  if (state === "pass") {
    return <CheckCircle2 className="size-4 text-emerald-300" />;
  }

  if (state === "warn") {
    return <AlertTriangle className="size-4 text-amber-300" />;
  }

  return <XCircle className="size-4 text-red-300" />;
}

function shortHex(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getSelectedVersion(proposal: Proposal, selectedVersionId: string) {
  return (
    proposal.versions.find((version) => version.id === selectedVersionId) ??
    proposal.versions.find((version) => version.id === proposal.activeVersionId) ??
    proposal.versions[0]
  );
}

function ProposalQueue({
  proposals,
  selectedProposalId,
  onSelect,
}: {
  proposals: Proposal[];
  selectedProposalId: string;
  onSelect: (proposalId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {proposals.map((proposal) => {
        const isSelected = proposal.id === selectedProposalId;

        return (
          <Button
            key={proposal.id}
            type="button"
            variant={isSelected ? "secondary" : "ghost"}
            className="h-auto w-full items-stretch justify-start whitespace-normal rounded-lg px-3 py-3 text-left"
            onClick={() => onSelect(proposal.id)}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex min-w-0 items-center justify-between gap-3">
                <span className="truncate font-medium">{proposal.title}</span>
                <span className="font-mono text-[0.7rem] text-muted-foreground">
                  {proposal.id}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                <StatusBadge status={proposal.status} />
                <RiskBadge risk={proposal.risk} />
              </span>
              <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span className="truncate">{proposal.org}</span>
                <span>{proposal.updatedAt}</span>
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function VersionGraph({
  proposal,
  selectedVersion,
  onSelect,
}: {
  proposal: Proposal;
  selectedVersion: ProposalVersion;
  onSelect: (versionId: string) => void;
}) {
  const versionById = new Map(
    proposal.versions.map((version) => [version.id, version])
  );

  return (
    <div className="relative h-[320px] min-h-[320px] overflow-hidden rounded-lg border bg-muted/20">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {proposal.versions.flatMap((version) =>
          version.parentIds.map((parentId) => {
            const parent = versionById.get(parentId);
            if (!parent) return null;

            const selected =
              version.id === selectedVersion.id ||
              parent.id === selectedVersion.id;
            const midX = (parent.x + version.x) / 2;

            return (
              <path
                key={`${parentId}-${version.id}`}
                d={`M ${parent.x} ${parent.y} C ${midX} ${parent.y}, ${midX} ${version.y}, ${version.x} ${version.y}`}
                fill="none"
                stroke={selected ? "oklch(0.76 0.15 155)" : "oklch(0.985 0 0 / 0.18)"}
                strokeDasharray={version.label === "alt" ? "3 3" : undefined}
                strokeLinecap="round"
                strokeWidth={selected ? 0.9 : 0.55}
              />
            );
          })
        )}
      </svg>

      {proposal.versions.map((version) => {
        const isSelected = version.id === selectedVersion.id;

        return (
          <Tooltip key={version.id}>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "absolute h-14 w-[8.4rem] -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-lg px-2 py-2 shadow-sm",
                    !isSelected && "bg-background/90 backdrop-blur"
                  )}
                  style={{ left: `${version.x}%`, top: `${version.y}%` }}
                  onClick={() => onSelect(version.id)}
                />
              }
            >
              <span className="flex items-center gap-1 text-xs">
                <GitBranch className="size-3" />
                {version.label}
              </span>
              <span className="max-w-full truncate font-mono text-[0.68rem] opacity-70">
                {version.id}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <span>{version.title}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function VersionDetails({ version }: { version: ProposalVersion }) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
      <div className="space-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-medium">{version.title}</h3>
            <StatusBadge status={version.status} />
            <RiskBadge risk={version.risk} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{version.summary}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {version.changes.map((change) => (
            <Badge key={change} variant="secondary">
              <Check className="size-3" />
              {change}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-2 rounded-lg border bg-background/60 p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Author</span>
          <span className="font-mono">{version.author}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Timestamp</span>
          <span>{version.timestamp}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Parents</span>
          <span className="font-mono">
            {version.parentIds.length ? version.parentIds.join(", ") : "root"}
          </span>
        </div>
      </div>
    </div>
  );
}

function ActionPicker({
  actions,
  selectedActionId,
  onSelect,
}: {
  actions: CalldataAction[];
  selectedActionId: string;
  onSelect: (actionId: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {actions.map((action, index) => {
        const isSelected = action.id === selectedActionId;

        return (
          <Button
            key={action.id}
            type="button"
            variant={isSelected ? "secondary" : "ghost"}
            className="h-auto justify-start whitespace-normal rounded-lg px-3 py-2 text-left"
            onClick={() => onSelect(action.id)}
          >
            <span className="flex w-full min-w-0 items-start gap-3">
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {action.label}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{action.selector}</span>
                  <RiskBadge risk={action.risk} />
                </span>
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}

function CalldataReview({
  proposal,
  selectedAction,
}: {
  proposal: Proposal;
  selectedAction: CalldataAction;
}) {
  const failingChecks = proposal.checks.filter((check) => check.state === "fail");
  const warningChecks = proposal.checks.filter((check) => check.state === "warn");

  return (
    <Tabs defaultValue="decoded" className="min-h-0">
      <TabsList className="w-full justify-start">
        <TabsTrigger value="decoded">
          <Code2 className="size-4" />
          Decoded
        </TabsTrigger>
        <TabsTrigger value="raw">
          <Network className="size-4" />
          Raw
        </TabsTrigger>
        <TabsTrigger value="checks">
          <ShieldCheck className="size-4" />
          Checks
        </TabsTrigger>
      </TabsList>

      <TabsContent value="decoded" className="space-y-4 pt-2">
        {failingChecks.length > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Blocked by review check</AlertTitle>
            <AlertDescription>{failingChecks[0].detail}</AlertDescription>
          </Alert>
        ) : warningChecks.length > 0 ? (
          <Alert>
            <AlertTriangle className="size-4 text-amber-300" />
            <AlertTitle>Review warning</AlertTitle>
            <AlertDescription>{warningChecks[0].detail}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 rounded-lg border bg-background/60 p-3">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Target</span>
            <span className="font-mono text-sm">
              {selectedAction.targetName} {shortHex(selectedAction.target)}
            </span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Function</span>
            <span className="font-mono text-sm">{selectedAction.signature}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Simulation</span>
            <span className="text-sm">{selectedAction.simulation}</span>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Argument</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {selectedAction.decodedArgs.map((arg) => (
              <TableRow key={`${arg.name}-${arg.type}`}>
                <TableCell className="font-medium">{arg.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {arg.type}
                </TableCell>
                <TableCell className="max-w-[12rem] truncate font-mono text-xs">
                  {arg.value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TabsContent>

      <TabsContent value="raw" className="pt-2">
        <ScrollArea className="h-[270px] rounded-lg border bg-background/60">
          <pre className="whitespace-pre-wrap break-all p-4 font-mono text-xs leading-6 text-muted-foreground">
            {selectedAction.calldata}
          </pre>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="checks" className="space-y-3 pt-2">
        {proposal.checks.map((check) => (
          <div
            key={check.label}
            className="flex items-start gap-3 rounded-lg border bg-background/60 p-3"
          >
            <CheckStateIcon state={check.state} />
            <div className="grid gap-1">
              <span className="text-sm font-medium">{check.label}</span>
              <span className="text-sm text-muted-foreground">{check.detail}</span>
            </div>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  );
}

function ReviewTimeline({ proposal }: { proposal: Proposal }) {
  return (
    <div className="space-y-3">
      {proposal.events.map((event) => (
        <div key={`${event.actor}-${event.timestamp}`} className="flex gap-3">
          <div className="mt-1 flex size-7 items-center justify-center rounded-full border bg-background">
            <History className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {event.actor}
              </span>
              <span className="text-xs text-muted-foreground">
                {event.timestamp}
              </span>
            </div>
            <p className="mt-1 text-sm">{event.action}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProposalReviewWorkspace() {
  const [selectedProposalId, setSelectedProposalId] = useState(mockProposals[0].id);
  const [selectedVersionId, setSelectedVersionId] = useState(
    mockProposals[0].activeVersionId
  );
  const [selectedActionId, setSelectedActionId] = useState(
    mockProposals[0].actions[0].id
  );
  const [query, setQuery] = useState("");

  const selectedProposal =
    mockProposals.find((proposal) => proposal.id === selectedProposalId) ??
    mockProposals[0];

  const selectedVersion = getSelectedVersion(selectedProposal, selectedVersionId);

  const selectedAction =
    selectedProposal.actions.find((action) => action.id === selectedActionId) ??
    selectedProposal.actions[0];

  const filteredProposals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return mockProposals;

    return mockProposals.filter((proposal) =>
      [proposal.id, proposal.title, proposal.org, proposal.chain]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [query]);

  function selectProposal(proposalId: string) {
    const nextProposal =
      mockProposals.find((proposal) => proposal.id === proposalId) ??
      mockProposals[0];

    setSelectedProposalId(nextProposal.id);
    setSelectedVersionId(nextProposal.activeVersionId);
    setSelectedActionId(nextProposal.actions[0].id);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <Clock className="size-3" />
              Mock review state
            </Badge>
            <StatusBadge status={selectedProposal.status} />
            <RiskBadge risk={selectedProposal.risk} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Calldata Review Desk
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {selectedProposal.description}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select
            value={selectedProposalId}
            onValueChange={(value) => {
              if (typeof value === "string") selectProposal(value);
            }}
          >
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder="Select proposal" />
            </SelectTrigger>
            <SelectContent align="end">
              {mockProposals.map((proposal) => (
                <SelectItem key={proposal.id} value={proposal.id}>
                  {proposal.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" className="lg:hidden">
                  <SlidersHorizontal className="size-4" />
                  Queue
                </Button>
              }
            />
            <SheetContent className="w-[min(92vw,420px)]">
              <SheetHeader>
                <SheetTitle>Proposal queue</SheetTitle>
                <SheetDescription>
                  {filteredProposals.length} review items
                </SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <ProposalQueue
                  proposals={filteredProposals}
                  selectedProposalId={selectedProposalId}
                  onSelect={selectProposal}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Review score</CardTitle>
            <CardAction>
              <ShieldCheck className="size-4 text-muted-foreground" />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-mono">{selectedProposal.reviewScore}%</span>
            </div>
            <Progress value={selectedProposal.reviewScore} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Approvals</CardTitle>
            <CardDescription>
              {selectedProposal.approvals} of {selectedProposal.requiredApprovals}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1">
              {Array.from({ length: selectedProposal.requiredApprovals }).map(
                (_, index) => (
                  <div
                    key={index}
                    className={cn(
                      "h-2 flex-1 rounded-full bg-muted",
                      index < selectedProposal.approvals && "bg-primary"
                    )}
                  />
                )
              )}
            </div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Active version</CardTitle>
            <CardDescription>{selectedVersion.title}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline" className="font-mono">
              {selectedVersion.id}
            </Badge>
            <Badge variant="secondary">{selectedProposal.chain}</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)_420px]">
        <aside className="hidden lg:block">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Proposal queue</CardTitle>
              <CardDescription>
                Production-shaped state with active review outcomes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proposal-search">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="proposal-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="pl-8"
                    placeholder="Proposal, org, chain"
                  />
                </div>
              </div>
              <ProposalQueue
                proposals={filteredProposals}
                selectedProposalId={selectedProposalId}
                onSelect={selectProposal}
              />
            </CardContent>
          </Card>
        </aside>

        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="size-4" />
                Version graph
              </CardTitle>
              <CardDescription>
                {selectedProposal.title} on {selectedProposal.chain}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <VersionGraph
                proposal={selectedProposal}
                selectedVersion={selectedVersion}
                onSelect={setSelectedVersionId}
              />
              <VersionDetails version={selectedVersion} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Execution plan</CardTitle>
              <CardDescription>
                {selectedProposal.actions.length} encoded calls in review
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Call</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Selector</TableHead>
                    <TableHead>Risk</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedProposal.actions.map((action) => (
                    <TableRow
                      key={action.id}
                      className={cn(
                        "cursor-pointer",
                        action.id === selectedAction.id && "bg-muted/70"
                      )}
                      onClick={() => setSelectedActionId(action.id)}
                    >
                      <TableCell className="font-medium">{action.label}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {shortHex(action.target)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {action.selector}
                      </TableCell>
                      <TableCell>
                        <RiskBadge risk={action.risk} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Calldata review</CardTitle>
              <CardDescription>{selectedAction.label}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionPicker
                actions={selectedProposal.actions}
                selectedActionId={selectedAction.id}
                onSelect={setSelectedActionId}
              />
              <Separator />
              <CalldataReview
                proposal={selectedProposal}
                selectedAction={selectedAction}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reviewer notes</CardTitle>
              <CardDescription>Current handoff state</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={`Version: ${selectedVersion.id}\nAction: ${selectedAction.label}\nDecision: ${selectedProposal.status === "ready" ? "approve when quorum completes" : "hold for reviewer changes"}`}
                readOnly
                className="min-h-[116px] resize-none font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm">
                  <CheckCircle2 className="size-4" />
                  Approve
                </Button>
                <Button type="button" size="sm" variant="outline">
                  <AlertTriangle className="size-4" />
                  Flag
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ReviewTimeline proposal={selectedProposal} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
