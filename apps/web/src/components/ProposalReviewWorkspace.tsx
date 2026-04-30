"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  GitBranch,
  MessageSquare,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
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
  mockExecutors,
  mockProposals,
  type CalldataAction,
  type Proposal,
  type ProposalStatus,
  type ProposalVersion,
  type Review,
  type ReviewDecision,
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

const decisionClassName: Record<ReviewDecision, string> = {
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  rejected: "border-red-500/30 bg-red-500/10 text-red-200",
};

const emptyAction: CalldataAction = {
  id: "new-action",
  target: "",
  value: "0",
  calldata: "0x",
};

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <Badge variant="outline" className={statusClassName[status]}>
      {statusLabel[status]}
    </Badge>
  );
}

function DecisionBadge({ decision }: { decision: ReviewDecision }) {
  const Icon = decision === "approved" ? CheckCircle2 : XCircle;

  return (
    <Badge variant="outline" className={decisionClassName[decision]}>
      <Icon className="size-3" />
      {decision}
    </Badge>
  );
}

function selectorFromCalldata(calldata: string) {
  return calldata.startsWith("0x") && calldata.length >= 10
    ? calldata.slice(0, 10)
    : "0x";
}

function shortAddress(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function getExecutorLabel(executorId: string) {
  return (
    mockExecutors.find((executor) => executor.id === executorId)?.label ??
    executorId
  );
}

function getSelectedVersion(proposal: Proposal, versionId: string) {
  return (
    proposal.versions.find((version) => version.id === versionId) ??
    proposal.versions[proposal.versions.length - 1]
  );
}

function ProposalList({
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
      {proposals.map((proposal) => (
        <Button
          key={proposal.id}
          type="button"
          variant={proposal.id === selectedProposalId ? "secondary" : "ghost"}
          className="h-auto w-full justify-start whitespace-normal rounded-lg px-3 py-3 text-left"
          onClick={() => onSelect(proposal.id)}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 truncate font-medium">
                {proposal.title}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {proposal.id}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={proposal.status} />
              <Badge variant="outline">{proposal.versions.length} versions</Badge>
              <Badge variant="outline">{proposal.reviews.length} reviews</Badge>
            </span>
            <span className="text-xs text-muted-foreground">
              {getExecutorLabel(proposal.executorId)}
            </span>
          </span>
        </Button>
      ))}
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
    <div className="relative h-[320px] overflow-hidden rounded-lg border bg-muted/20">
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
              parent.id === selectedVersion.id || version.id === selectedVersion.id;
            const midX = (parent.x + version.x) / 2;

            return (
              <path
                key={`${parentId}-${version.id}`}
                d={`M ${parent.x} ${parent.y} C ${midX} ${parent.y}, ${midX} ${version.y}, ${version.x} ${version.y}`}
                fill="none"
                stroke={
                  selected
                    ? "oklch(0.72 0.16 154)"
                    : "oklch(0.985 0 0 / 0.18)"
                }
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
                    "absolute h-14 w-[8.25rem] -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-lg px-2 py-2",
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
            <TooltipContent>{version.summary}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function VersionNavigator({
  proposal,
  selectedVersion,
  onSelect,
}: {
  proposal: Proposal;
  selectedVersion: ProposalVersion;
  onSelect: (versionId: string) => void;
}) {
  const selectedIndex = proposal.versions.findIndex(
    (version) => version.id === selectedVersion.id
  );
  const previousVersion = proposal.versions[selectedIndex - 1];
  const nextVersion = proposal.versions[selectedIndex + 1];

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {selectedVersion.id}
          </Badge>
          <span className="text-sm font-medium">{selectedVersion.label}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {selectedVersion.summary}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!previousVersion}
          onClick={() => previousVersion && onSelect(previousVersion.id)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!nextVersion}
          onClick={() => nextVersion && onSelect(nextVersion.id)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ActionList({
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
      {actions.map((action, index) => (
        <Button
          key={action.id}
          type="button"
          variant={action.id === selectedActionId ? "secondary" : "ghost"}
          className="h-auto justify-start whitespace-normal rounded-lg px-3 py-2 text-left"
          onClick={() => onSelect(action.id)}
        >
          <span className="flex w-full items-start gap-3">
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="grid min-w-0 gap-1">
              <span className="font-mono text-xs">
                {selectorFromCalldata(action.calldata)}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {shortAddress(action.target)}
              </span>
            </span>
          </span>
        </Button>
      ))}
    </div>
  );
}

function ReviewsList({
  reviews,
  selectedVersionId,
}: {
  reviews: Review[];
  selectedVersionId: string;
}) {
  const visibleReviews = reviews.filter(
    (review) => review.versionId === selectedVersionId
  );

  if (visibleReviews.length === 0) {
    return (
      <div className="rounded-lg border bg-background/60 p-3 text-sm text-muted-foreground">
        No reviews recorded for this version.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleReviews.map((review) => (
        <div key={review.id} className="rounded-lg border bg-background/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {review.reviewer}
            </span>
            <DecisionBadge decision={review.decision} />
          </div>
          <p className="mt-2 text-sm">{review.comment}</p>
          <p className="mt-2 text-xs text-muted-foreground">{review.createdAt}</p>
        </div>
      ))}
    </div>
  );
}

export function ProposalReviewWorkspace() {
  const [proposals, setProposals] = useState<Proposal[]>(mockProposals);
  const [selectedExecutorId, setSelectedExecutorId] = useState(
    mockExecutors[0].id
  );
  const [selectedProposalId, setSelectedProposalId] = useState(mockProposals[0].id);
  const [selectedVersionId, setSelectedVersionId] = useState(
    mockProposals[0].versions[mockProposals[0].versions.length - 1].id
  );
  const [selectedActionId, setSelectedActionId] = useState(
    mockProposals[0].versions[mockProposals[0].versions.length - 1].actions[0].id
  );
  const [query, setQuery] = useState("");
  const [reviewer, setReviewer] = useState("0xReviewer");
  const [reviewComment, setReviewComment] = useState("");
  const [newProposal, setNewProposal] = useState({
    title: "",
    description: "",
    executorId: mockExecutors[0].id,
    target: "",
    value: "0",
    calldata: "0x",
  });

  const selectedProposal =
    proposals.find((proposal) => proposal.id === selectedProposalId) ??
    proposals[0];
  const selectedVersion = getSelectedVersion(selectedProposal, selectedVersionId);
  const selectedAction =
    selectedVersion.actions.find((action) => action.id === selectedActionId) ??
    selectedVersion.actions[0] ??
    emptyAction;

  const filteredProposals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return proposals.filter((proposal) => {
      const matchesExecutor = proposal.executorId === selectedExecutorId;
      const matchesQuery =
        !normalizedQuery ||
        [proposal.id, proposal.title, proposal.description]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesExecutor && matchesQuery;
    });
  }, [proposals, query, selectedExecutorId]);

  function selectProposal(proposalId: string) {
    const proposal = proposals.find((item) => item.id === proposalId);
    if (!proposal) return;

    const nextVersion = proposal.versions[proposal.versions.length - 1];
    setSelectedProposalId(proposal.id);
    setSelectedExecutorId(proposal.executorId);
    setSelectedVersionId(nextVersion.id);
    setSelectedActionId(nextVersion.actions[0]?.id ?? "");
  }

  function selectVersion(versionId: string) {
    const version = selectedProposal.versions.find((item) => item.id === versionId);
    if (!version) return;

    setSelectedVersionId(version.id);
    setSelectedActionId(version.actions[0]?.id ?? "");
  }

  function updateSelectedAction(nextAction: CalldataAction) {
    setProposals((current) =>
      current.map((proposal) => {
        if (proposal.id !== selectedProposal.id) return proposal;

        return {
          ...proposal,
          versions: proposal.versions.map((version) => {
            if (version.id !== selectedVersion.id) return version;

            return {
              ...version,
              actions: version.actions.map((action) =>
                action.id === nextAction.id ? nextAction : action
              ),
            };
          }),
        };
      })
    );
  }

  function submitReview(decision: ReviewDecision) {
    if (!selectedAction.id || !reviewComment.trim()) return;

    const nextReview: Review = {
      id: `review-${Date.now()}`,
      versionId: selectedVersion.id,
      actionId: selectedAction.id,
      reviewer,
      decision,
      comment: reviewComment.trim(),
      createdAt: "Just now",
    };

    setProposals((current) =>
      current.map((proposal) =>
        proposal.id === selectedProposal.id
          ? {
              ...proposal,
              status: decision,
              reviews: [nextReview, ...proposal.reviews],
            }
          : proposal
      )
    );
    setReviewComment("");
  }

  function createProposal() {
    if (
      !newProposal.title.trim() ||
      !newProposal.target.trim() ||
      !newProposal.calldata.trim()
    ) {
      return;
    }

    const index = proposals.length + 1;
    const proposalId = `prop-${String(index).padStart(3, "0")}`;
    const versionId = `${proposalId}-v1`;
    const actionId = `${versionId}-a1`;
    const proposal: Proposal = {
      id: proposalId,
      executorId: newProposal.executorId,
      title: newProposal.title.trim(),
      description: newProposal.description.trim() || "No description provided.",
      status: "draft",
      createdAt: "Just now",
      versions: [
        {
          id: versionId,
          label: "v1",
          parentIds: [],
          author: "current user",
          createdAt: "Just now",
          summary: "Initial version created from the form.",
          x: 50,
          y: 50,
          actions: [
            {
              id: actionId,
              target: newProposal.target.trim(),
              value: newProposal.value.trim() || "0",
              calldata: newProposal.calldata.trim(),
            },
          ],
        },
      ],
      reviews: [],
    };

    setProposals((current) => [proposal, ...current]);
    setSelectedExecutorId(proposal.executorId);
    setSelectedProposalId(proposal.id);
    setSelectedVersionId(versionId);
    setSelectedActionId(actionId);
    setNewProposal({
      title: "",
      description: "",
      executorId: newProposal.executorId,
      target: "",
      value: "0",
      calldata: "0x",
    });
  }

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              <Building2 className="size-3" />
              {getExecutorLabel(selectedProposal.executorId)}
            </Badge>
            <StatusBadge status={selectedProposal.status} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Calldata Proposal Review
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Create proposals, find them by executor, navigate their version
            graph, edit calldata, and record review decisions.
          </p>
        </div>

        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" className="lg:hidden">
                <Search className="size-4" />
                Find proposals
              </Button>
            }
          />
          <SheetContent className="w-[min(92vw,420px)]">
            <SheetHeader>
              <SheetTitle>Find proposals</SheetTitle>
              <SheetDescription>
                Filter by executor and proposal text.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4">
              <ExecutorAndSearch
                selectedExecutorId={selectedExecutorId}
                setSelectedExecutorId={setSelectedExecutorId}
                query={query}
                setQuery={setQuery}
              />
              <ProposalList
                proposals={filteredProposals}
                selectedProposalId={selectedProposal.id}
                onSelect={selectProposal}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)_420px]">
        <aside className="hidden lg:block">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Find proposals</CardTitle>
              <CardDescription>
                Filter the proposal list by executor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ExecutorAndSearch
                selectedExecutorId={selectedExecutorId}
                setSelectedExecutorId={setSelectedExecutorId}
                query={query}
                setQuery={setQuery}
              />
              <ProposalList
                proposals={filteredProposals}
                selectedProposalId={selectedProposal.id}
                onSelect={selectProposal}
              />
            </CardContent>
          </Card>
        </aside>

        <main className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Create proposal</CardTitle>
              <CardDescription>
                Start with one target, value, and calldata payload.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="new-title">Title</Label>
                  <Input
                    id="new-title"
                    value={newProposal.title}
                    onChange={(event) =>
                      setNewProposal((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Proposal title"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Executor</Label>
                  <Select
                    value={newProposal.executorId}
                    onValueChange={(value) => {
                      if (typeof value === "string") {
                        setNewProposal((current) => ({
                          ...current,
                          executorId: value,
                        }));
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <span>{getExecutorLabel(newProposal.executorId)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {mockExecutors.map((executor) => (
                        <SelectItem key={executor.id} value={executor.id}>
                          {executor.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-description">Description</Label>
                <Textarea
                  id="new-description"
                  value={newProposal.description}
                  onChange={(event) =>
                    setNewProposal((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="What should reviewers verify?"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                <div className="grid gap-2">
                  <Label htmlFor="new-target">Target</Label>
                  <Input
                    id="new-target"
                    value={newProposal.target}
                    onChange={(event) =>
                      setNewProposal((current) => ({
                        ...current,
                        target: event.target.value,
                      }))
                    }
                    className="font-mono"
                    placeholder="0x..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-value">Value</Label>
                  <Input
                    id="new-value"
                    value={newProposal.value}
                    onChange={(event) =>
                      setNewProposal((current) => ({
                        ...current,
                        value: event.target.value,
                      }))
                    }
                    className="font-mono"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-calldata">Calldata</Label>
                <Textarea
                  id="new-calldata"
                  value={newProposal.calldata}
                  onChange={(event) =>
                    setNewProposal((current) => ({
                      ...current,
                      calldata: event.target.value,
                    }))
                  }
                  className="min-h-[104px] font-mono text-xs"
                />
              </div>
              <Button type="button" onClick={createProposal}>
                <Plus className="size-4" />
                Create proposal
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="size-4" />
                Proposal history
              </CardTitle>
              <CardDescription>
                {selectedProposal.title} in{" "}
                {getExecutorLabel(selectedProposal.executorId)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <VersionGraph
                proposal={selectedProposal}
                selectedVersion={selectedVersion}
                onSelect={selectVersion}
              />
              <VersionNavigator
                proposal={selectedProposal}
                selectedVersion={selectedVersion}
                onSelect={selectVersion}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version calldata</CardTitle>
              <CardDescription>
                Select a row to edit that calldata in the review panel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Selector</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedVersion.actions.map((action, index) => (
                    <TableRow
                      key={action.id}
                      className={cn(
                        "cursor-pointer",
                        action.id === selectedAction.id && "bg-muted/70"
                      )}
                      onClick={() => setSelectedActionId(action.id)}
                    >
                      <TableCell>{String(index + 1).padStart(2, "0")}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {shortAddress(action.target)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {action.value}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {selectorFromCalldata(action.calldata)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>

        <section className="grid min-w-0 gap-6 content-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code2 className="size-4" />
                Calldata review
              </CardTitle>
              <CardDescription>{selectedVersion.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionList
                actions={selectedVersion.actions}
                selectedActionId={selectedAction.id}
                onSelect={setSelectedActionId}
              />
              <Separator />
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="target">Target</Label>
                  <Input
                    id="target"
                    value={selectedAction.target}
                    onChange={(event) =>
                      updateSelectedAction({
                        ...selectedAction,
                        target: event.target.value,
                      })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="value">Value</Label>
                  <Input
                    id="value"
                    value={selectedAction.value}
                    onChange={(event) =>
                      updateSelectedAction({
                        ...selectedAction,
                        value: event.target.value,
                      })
                    }
                    className="font-mono"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="calldata">Calldata</Label>
                  <Textarea
                    id="calldata"
                    value={selectedAction.calldata}
                    onChange={(event) =>
                      updateSelectedAction({
                        ...selectedAction,
                        calldata: event.target.value,
                      })
                    }
                    className="min-h-[160px] font-mono text-xs"
                  />
                </div>
              </div>

              <Tabs defaultValue="review">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="review">
                    <MessageSquare className="size-4" />
                    Review
                  </TabsTrigger>
                  <TabsTrigger value="raw">
                    <Code2 className="size-4" />
                    Raw
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="review" className="space-y-3 pt-2">
                  <div className="grid gap-2">
                    <Label htmlFor="reviewer">Reviewer</Label>
                    <Input
                      id="reviewer"
                      value={reviewer}
                      onChange={(event) => setReviewer(event.target.value)}
                      className="font-mono"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="review-comment">Review note</Label>
                    <Textarea
                      id="review-comment"
                      value={reviewComment}
                      onChange={(event) => setReviewComment(event.target.value)}
                      placeholder="What did you verify?"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => submitReview("approved")}
                      disabled={!reviewComment.trim()}
                    >
                      <CheckCircle2 className="size-4" />
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => submitReview("rejected")}
                      disabled={!reviewComment.trim()}
                    >
                      <XCircle className="size-4" />
                      Reject
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="raw" className="pt-2">
                  <ScrollArea className="h-[220px] rounded-lg border bg-background/60">
                    <pre className="whitespace-pre-wrap break-all p-4 font-mono text-xs leading-6 text-muted-foreground">
                      {selectedAction.calldata}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
              <CardDescription>
                Decisions recorded for the selected version.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewsList
                reviews={selectedProposal.reviews}
                selectedVersionId={selectedVersion.id}
              />
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function ExecutorAndSearch({
  selectedExecutorId,
  setSelectedExecutorId,
  query,
  setQuery,
}: {
  selectedExecutorId: string;
  setSelectedExecutorId: (executorId: string) => void;
  query: string;
  setQuery: (query: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Executor</Label>
        <Select
          value={selectedExecutorId}
          onValueChange={(value) => {
            if (typeof value === "string") setSelectedExecutorId(value);
          }}
        >
          <SelectTrigger className="w-full">
            <span>{getExecutorLabel(selectedExecutorId)}</span>
          </SelectTrigger>
          <SelectContent>
            {mockExecutors.map((executor) => (
              <SelectItem key={executor.id} value={executor.id}>
                {executor.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="proposal-search">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="proposal-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-8"
            placeholder="Proposal title or id"
          />
        </div>
      </div>
    </div>
  );
}
