"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  GitBranch,
  GitFork,
  MessageSquare,
  Plus,
  Search,
  XCircle,
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
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
  mockDrafts,
  type CalldataAction,
  type Draft,
  type DraftReview,
  type ReviewDecision,
} from "@/lib/mock-proposals";

type DraftForm = {
  executor: string;
  description: string;
  extraData: string;
  previousVersion: string | null;
  target: string;
  value: string;
  calldata: string;
};

const emptyAction: CalldataAction = {
  id: "empty-action",
  target: "",
  value: "0",
  calldata: "0x",
};

const emptyForm: DraftForm = {
  executor: "",
  description: "",
  extraData: "0x",
  previousVersion: null,
  target: "",
  value: "0",
  calldata: "0x",
};

const decisionClassName: Record<ReviewDecision, string> = {
  approved: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  rejected: "border-red-500/30 bg-red-500/10 text-red-200",
};

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

function getDraftDepth(
  draft: Draft,
  byId: Map<string, Draft>,
  seen = new Set<string>()
): number {
  if (!draft.previousVersion) return 0;
  if (seen.has(draft.id)) return 0;

  const parent = byId.get(draft.previousVersion);
  if (!parent) return 0;

  seen.add(draft.id);
  return getDraftDepth(parent, byId, seen) + 1;
}

function getRootDraft(draft: Draft, byId: Map<string, Draft>) {
  let current = draft;
  const seen = new Set<string>();

  while (current.previousVersion && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.previousVersion);
    if (!parent) break;
    current = parent;
  }

  return current;
}

function getDraftFamily(drafts: Draft[], selectedDraft: Draft) {
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  const root = getRootDraft(selectedDraft, byId);
  const childrenByParent = drafts.reduce((children, draft) => {
    if (!draft.previousVersion) return children;
    const current = children.get(draft.previousVersion) ?? [];
    current.push(draft);
    children.set(draft.previousVersion, current);
    return children;
  }, new Map<string, Draft[]>());

  const family: Draft[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || family.some((draft) => draft.id === current.id)) continue;
    family.push(current);
    queue.push(...(childrenByParent.get(current.id) ?? []));
  }

  return family;
}

function layoutDrafts(drafts: Draft[]) {
  const byId = new Map(drafts.map((draft) => [draft.id, draft]));
  const draftsByDepth = new Map<number, Draft[]>();

  for (const draft of drafts) {
    const depth = getDraftDepth(draft, byId);
    const current = draftsByDepth.get(depth) ?? [];
    current.push(draft);
    draftsByDepth.set(depth, current);
  }

  const maxDepth = Math.max(...draftsByDepth.keys(), 0);
  const xStep = maxDepth === 0 ? 0 : 76 / maxDepth;

  return drafts.map((draft) => {
    const depth = getDraftDepth(draft, byId);
    const siblings = draftsByDepth.get(depth) ?? [draft];
    const siblingIndex = siblings.findIndex((item) => item.id === draft.id);

    return {
      ...draft,
      depth,
      x: maxDepth === 0 ? 50 : 12 + depth * xStep,
      y: ((siblingIndex + 1) / (siblings.length + 1)) * 100,
    };
  });
}

function getNextDraftId(drafts: Draft[]) {
  const maxNumericId = drafts.reduce((max, draft) => {
    const value = Number(draft.id);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

  return String(maxNumericId + 1);
}

function getInitialAction(draft: Draft) {
  return draft.actions[0] ?? emptyAction;
}

function DraftReviewsBadge({ draft }: { draft: Draft }) {
  const totals = reviewTotals(draft);

  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="outline">
        <MessageSquare className="size-3" />
        {draft.reviews.length}
      </Badge>
      <Badge variant="outline" className="text-emerald-200">
        {totals.approved} approved
      </Badge>
      <Badge variant="outline" className="text-red-200">
        {totals.rejected} rejected
      </Badge>
    </div>
  );
}

function DraftTable({
  drafts,
  selectedDraftId,
  onSelect,
  onFork,
}: {
  drafts: Draft[];
  selectedDraftId: string;
  onSelect: (draftId: string) => void;
  onFork: (draft: Draft) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Draft</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Executor</TableHead>
            <TableHead>Timestamp</TableHead>
            <TableHead>Reviews</TableHead>
            <TableHead className="w-[92px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drafts.map((draft) => (
            <TableRow
              key={draft.id}
              className={cn(
                "cursor-pointer",
                draft.id === selectedDraftId && "bg-muted/70"
              )}
              onClick={() => onSelect(draft.id)}
            >
              <TableCell className="min-w-[260px]">
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      Draft #{draft.id}
                    </span>
                    {draft.previousVersion ? (
                      <Badge variant="outline">
                        <GitBranch className="size-3" />
                        from #{draft.previousVersion}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="max-w-[34rem] truncate text-sm text-muted-foreground">
                    {draft.description || "No description"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {shortAddress(draft.proposer)}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {shortAddress(draft.executor)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {draft.timestamp}
              </TableCell>
              <TableCell>
                <DraftReviewsBadge draft={draft} />
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onFork(draft);
                  }}
                >
                  <GitFork className="size-3.5" />
                  Fork
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DraftGraph({
  drafts,
  selectedDraft,
  onSelect,
}: {
  drafts: Draft[];
  selectedDraft: Draft;
  onSelect: (draftId: string) => void;
}) {
  const positionedDrafts = useMemo(() => layoutDrafts(drafts), [drafts]);
  const byId = new Map(positionedDrafts.map((draft) => [draft.id, draft]));

  return (
    <div className="relative h-[300px] overflow-hidden rounded-lg border bg-muted/20">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {positionedDrafts.map((draft) => {
          if (!draft.previousVersion) return null;

          const parent = byId.get(draft.previousVersion);
          if (!parent) return null;

          const selected =
            parent.id === selectedDraft.id || draft.id === selectedDraft.id;
          const midX = (parent.x + draft.x) / 2;

          return (
            <path
              key={`${draft.previousVersion}-${draft.id}`}
              d={`M ${parent.x} ${parent.y} C ${midX} ${parent.y}, ${midX} ${draft.y}, ${draft.x} ${draft.y}`}
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
        })}
      </svg>

      {positionedDrafts.map((draft) => {
        const isSelected = draft.id === selectedDraft.id;
        const totals = reviewTotals(draft);

        return (
          <Tooltip key={draft.id}>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  className={cn(
                    "absolute h-16 w-[8.5rem] -translate-x-1/2 -translate-y-1/2 flex-col gap-0.5 rounded-lg px-2 py-2",
                    !isSelected && "bg-background/90 backdrop-blur"
                  )}
                  style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
                  onClick={() => onSelect(draft.id)}
                />
              }
            >
              <span className="flex items-center gap-1 text-xs">
                <GitBranch className="size-3" />
                Draft #{draft.id}
              </span>
              <span className="font-mono text-[0.68rem] opacity-75">
                {totals.approved}/{draft.reviews.length} reviews
              </span>
            </TooltipTrigger>
            <TooltipContent>{draft.description || `Draft #${draft.id}`}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function DraftNavigator({
  drafts,
  selectedDraft,
  onSelect,
}: {
  drafts: Draft[];
  selectedDraft: Draft;
  onSelect: (draftId: string) => void;
}) {
  const parent = selectedDraft.previousVersion
    ? drafts.find((draft) => draft.id === selectedDraft.previousVersion)
    : undefined;
  const children = drafts.filter(
    (draft) => draft.previousVersion === selectedDraft.id
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">
            Draft #{selectedDraft.id}
          </Badge>
          <Badge variant="outline">
            {selectedDraft.previousVersion
              ? `previous #${selectedDraft.previousVersion}`
              : "root"}
          </Badge>
        </div>
        <p className="mt-2 truncate text-sm text-muted-foreground">
          {selectedDraft.description || "No description"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!parent}
          onClick={() => parent && onSelect(parent.id)}
        >
          <ChevronLeft className="size-4" />
          Parent
        </Button>
        {children.slice(0, 2).map((child) => (
          <Button
            key={child.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelect(child.id)}
          >
            Child #{child.id}
            <ChevronRight className="size-4" />
          </Button>
        ))}
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

function ReviewsList({ reviews }: { reviews: DraftReview[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border bg-background/60 p-3 text-sm text-muted-foreground">
        No reviews recorded for this draft.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border bg-background/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {shortAddress(review.reviewer)}
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
  const { address } = useAccount();
  const [drafts, setDrafts] = useState<Draft[]>(mockDrafts);
  const [selectedDraftId, setSelectedDraftId] = useState(mockDrafts[0].id);
  const [selectedActionId, setSelectedActionId] = useState(
    getInitialAction(mockDrafts[0]).id
  );
  const [query, setQuery] = useState("");
  const [reviewer, setReviewer] = useState("0xReviewer");
  const [reviewComment, setReviewComment] = useState("");
  const [isDraftSheetOpen, setIsDraftSheetOpen] = useState(false);
  const [draftForm, setDraftForm] = useState<DraftForm>(emptyForm);

  const selectedDraft =
    drafts.find((draft) => draft.id === selectedDraftId) ?? drafts[0];
  const selectedAction =
    selectedDraft.actions.find((action) => action.id === selectedActionId) ??
    selectedDraft.actions[0] ??
    emptyAction;

  const filteredDrafts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return drafts;

    return drafts.filter((draft) =>
      [
        draft.id,
        draft.executor,
        draft.proposer,
        draft.description,
        draft.previousVersion ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [drafts, query]);

  const draftFamily = useMemo(
    () => getDraftFamily(drafts, selectedDraft),
    [drafts, selectedDraft]
  );

  function selectDraft(draftId: string) {
    const draft = drafts.find((item) => item.id === draftId);
    if (!draft) return;

    setSelectedDraftId(draft.id);
    setSelectedActionId(getInitialAction(draft).id);
  }

  function openCreateDraft() {
    setDraftForm(emptyForm);
    setIsDraftSheetOpen(true);
  }

  function openForkDraft(draft: Draft) {
    const action = getInitialAction(draft);

    setDraftForm({
      executor: draft.executor,
      description: "",
      extraData: draft.extraData || "0x",
      previousVersion: draft.id,
      target: action.target,
      value: action.value,
      calldata: action.calldata,
    });
    setIsDraftSheetOpen(true);
  }

  function updateSelectedAction(nextAction: CalldataAction) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== selectedDraft.id) return draft;

        return {
          ...draft,
          actions: draft.actions.map((action) =>
            action.id === nextAction.id ? nextAction : action
          ),
        };
      })
    );
  }

  function submitReview(decision: ReviewDecision) {
    if (!reviewComment.trim()) return;

    const nextReview: DraftReview = {
      id: `review-${Date.now()}`,
      draftId: selectedDraft.id,
      reviewer,
      decision,
      comment: reviewComment.trim(),
      createdAt: "Just now",
    };

    setDrafts((current) =>
      current.map((draft) =>
        draft.id === selectedDraft.id
          ? {
              ...draft,
              reviews: [nextReview, ...draft.reviews],
            }
          : draft
      )
    );
    setReviewComment("");
  }

  function createDraft() {
    if (
      !draftForm.executor.trim() ||
      !draftForm.target.trim() ||
      !draftForm.calldata.trim()
    ) {
      return;
    }

    const draftId = getNextDraftId(drafts);
    const actionId = `draft-${draftId}-action-1`;
    const draft: Draft = {
      id: draftId,
      executor: draftForm.executor.trim(),
      proposer: address ?? "not connected",
      description: draftForm.description.trim(),
      extraData: draftForm.extraData.trim() || "0x",
      previousVersion: draftForm.previousVersion,
      timestamp: "Just now",
      actions: [
        {
          id: actionId,
          target: draftForm.target.trim(),
          value: draftForm.value.trim() || "0",
          calldata: draftForm.calldata.trim(),
        },
      ],
      reviews: [],
    };

    setDrafts((current) => [draft, ...current]);
    setSelectedDraftId(draft.id);
    setSelectedActionId(actionId);
    setDraftForm(emptyForm);
    setIsDraftSheetOpen(false);
  }

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              <GitBranch className="size-3" />
              Drafts
            </Badge>
            <Badge variant="outline">{drafts.length} total</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Calldata Drafts
          </h1>
        </div>
        <Button type="button" onClick={openCreateDraft}>
          <Plus className="size-4" />
          Create draft
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All drafts</CardTitle>
          <CardDescription>
            Draft records from the mocked registry state.
          </CardDescription>
          <CardAction>
            <div className="relative w-full min-w-[220px] sm:w-[320px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
                placeholder="Draft, author, executor"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DraftTable
            drafts={filteredDrafts}
            selectedDraftId={selectedDraft.id}
            onSelect={selectDraft}
            onFork={openForkDraft}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <main className="grid min-w-0 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="size-4" />
                Draft history
              </CardTitle>
              <CardDescription>
                Selected draft and versions linked through previousVersion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <DraftGraph
                drafts={draftFamily}
                selectedDraft={selectedDraft}
                onSelect={selectDraft}
              />
              <DraftNavigator
                drafts={drafts}
                selectedDraft={selectedDraft}
                onSelect={selectDraft}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selected draft</CardTitle>
              <CardDescription className="font-mono">
                Draft #{selectedDraft.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Author</span>
                  <span className="break-all font-mono text-sm">
                    {selectedDraft.proposer}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Executor</span>
                  <span className="break-all font-mono text-sm">
                    {selectedDraft.executor}
                  </span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">Timestamp</span>
                  <span className="text-sm">{selectedDraft.timestamp}</span>
                </div>
                <div className="grid gap-1">
                  <span className="text-xs text-muted-foreground">
                    Previous version
                  </span>
                  <span className="font-mono text-sm">
                    {selectedDraft.previousVersion
                      ? `#${selectedDraft.previousVersion}`
                      : "0"}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="grid gap-2">
                <span className="text-xs text-muted-foreground">Description</span>
                <p className="text-sm">
                  {selectedDraft.description || "No description"}
                </p>
              </div>
              <div className="grid gap-2">
                <span className="text-xs text-muted-foreground">Extra data</span>
                <pre className="overflow-x-auto rounded-lg border bg-background/60 p-3 font-mono text-xs text-muted-foreground">
                  {selectedDraft.extraData || "0x"}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Calldata actions</CardTitle>
              <CardDescription>
                Select a row to edit that action in the review panel.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
                    {selectedDraft.actions.map((action, index) => (
                      <TableRow
                        key={action.id}
                        className={cn(
                          "cursor-pointer",
                          action.id === selectedAction.id && "bg-muted/70"
                        )}
                        onClick={() => setSelectedActionId(action.id)}
                      >
                        <TableCell>
                          {String(index + 1).padStart(2, "0")}
                        </TableCell>
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
              </div>
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
              <CardDescription className="font-mono">
                Draft #{selectedDraft.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ActionList
                actions={selectedDraft.actions}
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
              <CardDescription>Review records for this draft.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReviewsList reviews={selectedDraft.reviews} />
            </CardContent>
          </Card>
        </section>
      </div>

      <Sheet open={isDraftSheetOpen} onOpenChange={setIsDraftSheetOpen}>
        <SheetContent className="w-[min(94vw,520px)] overflow-y-auto sm:max-w-[520px]">
          <SheetHeader>
            <SheetTitle>
              {draftForm.previousVersion ? "Fork draft" : "Create draft"}
            </SheetTitle>
            <SheetDescription>
              {draftForm.previousVersion
                ? `previousVersion = ${draftForm.previousVersion}`
                : "previousVersion = 0"}
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 px-4 pb-4">
            <div className="grid gap-2">
              <Label htmlFor="new-executor">Executor address or ENS</Label>
              <Input
                id="new-executor"
                value={draftForm.executor}
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    executor: event.target.value,
                  }))
                }
                className="font-mono"
                placeholder="0x... or name.eth"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-description">Description</Label>
              <Textarea
                id="new-description"
                value={draftForm.description}
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Markdown description"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="new-extra-data">Extra data</Label>
              <Input
                id="new-extra-data"
                value={draftForm.extraData}
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    extraData: event.target.value,
                  }))
                }
                className="font-mono"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_120px]">
              <div className="grid gap-2">
                <Label htmlFor="new-target">Target</Label>
                <Input
                  id="new-target"
                  value={draftForm.target}
                  onChange={(event) =>
                    setDraftForm((current) => ({
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
                  value={draftForm.value}
                  onChange={(event) =>
                    setDraftForm((current) => ({
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
                value={draftForm.calldata}
                onChange={(event) =>
                  setDraftForm((current) => ({
                    ...current,
                    calldata: event.target.value,
                  }))
                }
                className="min-h-[140px] font-mono text-xs"
              />
            </div>

            <Button
              type="button"
              onClick={createDraft}
              disabled={
                !draftForm.executor.trim() ||
                !draftForm.target.trim() ||
                !draftForm.calldata.trim()
              }
            >
              <Plus className="size-4" />
              {draftForm.previousVersion ? "Create fork" : "Create draft"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
