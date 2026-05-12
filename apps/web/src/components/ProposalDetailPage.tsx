"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import {
  ArrowLeft,
  CheckCircle2,
  Code2,
  GitBranch,
  GitFork,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { CalldataCallBuilder } from "@/components/CalldataCallBuilder";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useDecodedActions } from "@/hooks/useCalldataDecoder";
import { cn } from "@/lib/utils";
import {
  mockDrafts,
  type Draft,
  type DraftReview,
  type ReviewDecision,
} from "@/lib/mock-proposals";
import type {
  DecodedAction,
  DecodedCall,
  DecodedParam,
  JsonValue,
} from "@/lib/calldataDecoder";

const decisionClassName: Record<ReviewDecision, string> = {
  approved: "border-foreground/30 bg-foreground/5 text-foreground",
  rejected: "border-border bg-muted text-muted-foreground",
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
  const xStep = maxDepth === 0 ? 0 : 78 / maxDepth;

  return drafts.map((draft) => {
    const depth = getDraftDepth(draft, byId);
    const siblings = draftsByDepth.get(depth) ?? [draft];
    const siblingIndex = siblings.findIndex((item) => item.id === draft.id);

    return {
      ...draft,
      depth,
      x: maxDepth === 0 ? 50 : 11 + depth * xStep,
      y: ((siblingIndex + 1) / (siblings.length + 1)) * 100,
    };
  });
}

function HistoryGraph({
  drafts,
  selectedDraft,
}: {
  drafts: Draft[];
  selectedDraft: Draft;
}) {
  const positionedDrafts = useMemo(() => layoutDrafts(drafts), [drafts]);
  const byId = new Map(positionedDrafts.map((draft) => [draft.id, draft]));

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="relative h-[180px] min-w-[520px] bg-card">
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
                stroke={selected ? "var(--foreground)" : "var(--border)"}
                strokeLinecap="round"
                strokeWidth={selected ? 0.9 : 0.55}
              />
            );
          })}
        </svg>

        {positionedDrafts.map((draft) => {
          const isSelected = draft.id === selectedDraft.id;

          return (
            <Link
              key={draft.id}
              href={draftPath(draft)}
              aria-current={isSelected ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: isSelected ? "default" : "outline" }),
                "absolute z-10 h-12 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-start gap-0.5 rounded-lg px-2.5 py-1.5 text-left",
                !isSelected && "bg-background"
              )}
              style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
            >
              <span className="flex items-center gap-1 text-xs">
                <GitBranch className="size-3" />
                #{draft.id}
              </span>
              <span className="font-mono text-[0.68rem] opacity-75">
                {shortAddress(draft.proposer)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ReviewsList({ reviews }: { reviews: DraftReview[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
        No reviews recorded for this record.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border bg-card p-3">
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

function formatJsonValue(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value) || typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function DecodedParamRow({
  param,
  index = 0,
  depth = 0,
}: {
  param: DecodedParam;
  index?: number;
  depth?: number;
}) {
  const hasChildren = param.children && param.children.length > 0;
  const label = param.name || `Input ${index + 1}`;

  return (
    <div className="grid gap-2" style={{ marginLeft: `${depth * 12}px` }}>
      <div className="grid gap-2 rounded-lg bg-muted/40 px-3 py-2 sm:grid-cols-[minmax(120px,0.45fr)_1fr] sm:items-baseline">
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {param.type}
          </div>
        </div>
        {!hasChildren ? (
          <div className="break-all font-mono text-sm text-foreground">
            {formatJsonValue(param.value)}
          </div>
        ) : null}
      </div>
      {hasChildren ? (
        <div className="grid gap-2 border-l pl-3">
          {param.children!.map((child, index) => (
            <DecodedParamRow
              key={`${child.name}-${index}`}
              param={child}
              index={index}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
      {param.decodedBytes ? (
        <div className="mt-3 rounded-lg border bg-muted p-3">
          <DecodedCallBlock call={param.decodedBytes} />
        </div>
      ) : null}
    </div>
  );
}

function DecodedCallBlock({ call }: { call: DecodedCall }) {
  const matchLabel =
    call.source === "verified-abi"
      ? "Verified ABI"
      : call.source === "native-transfer"
        ? "Native transfer"
        : "Likely match";

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{matchLabel}</Badge>
        </div>
        <div className="break-all font-mono text-base font-medium text-foreground">
          {call.signature}
        </div>
      </div>
      {call.params.length > 0 ? (
        <div className="grid gap-2">
          {call.params.map((param, index) => (
            <DecodedParamRow
              key={`${param.name}-${index}`}
              param={param}
              index={index}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No parameters.</p>
      )}
    </div>
  );
}

function DecodedActionState({
  action,
  isLoading,
  isError,
}: {
  action: DecodedAction | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Checking calldata...</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Decoder unavailable.
      </p>
    );
  }

  if (!action) {
    return <p className="text-sm text-muted-foreground">No decoder result.</p>;
  }

  if ((action.status === "decoded" || action.status === "empty") && action.decoded) {
    return <DecodedCallBlock call={action.decoded} />;
  }

  if (action.status === "ambiguous") {
    return (
      <div className="grid gap-2">
        <Badge variant="outline" className="w-fit">
          Needs ABI
        </Badge>
        <p className="text-sm text-muted-foreground">
          Several functions could match this call. Add the target contract ABI
          before relying on a decoded view.
        </p>
        <div className="flex flex-wrap gap-2">
          {(action.candidates ?? []).map((candidate) => (
            <Badge key={candidate} variant="outline" className="font-mono">
              {candidate}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Badge variant="outline" className="w-fit">
        Needs ABI
      </Badge>
      <p className="text-sm text-muted-foreground">
        This call could not be decoded reliably from calldata alone.
      </p>
      {action.candidates && action.candidates.length > 0 ? (
        <div className="grid gap-1">
          <div className="text-xs font-medium text-muted-foreground">
            Possible function
          </div>
          <p className="break-all font-mono text-sm">
            {action.candidates[0]}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function DecodedCallsPanel({
  actions,
  decodedActions,
  isLoading,
  isError,
}: {
  actions: Draft["actions"];
  decodedActions: DecodedAction[] | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      {actions.map((action, index) => (
        <div
          key={action.id}
          className="grid gap-3 border-b p-4 last:border-b-0 sm:grid-cols-[90px_1fr]"
        >
          <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            Call {String(index + 1).padStart(2, "0")}
          </div>
          <DecodedActionState
            action={decodedActions?.[index]}
            isLoading={isLoading}
            isError={isError}
          />
        </div>
      ))}
    </div>
  );
}

export function ProposalDetailPage({
  initialDraftId,
}: {
  initialDraftId: string;
}) {
  const { address, chainId } = useAccount();
  const initialDraft =
    mockDrafts.find((draft) => draft.id === initialDraftId) ?? mockDrafts[0];
  const [drafts, setDrafts] = useState<Draft[]>(mockDrafts);
  const [reviewComment, setReviewComment] = useState("");

  const selectedDraft =
    drafts.find((draft) => draft.id === initialDraftId) ?? initialDraft;
  const draftFamily = useMemo(
    () => getDraftFamily(drafts, selectedDraft),
    [drafts, selectedDraft]
  );
  const decoderActions = useMemo(
    () =>
      selectedDraft.actions.map(({ target, value, calldata }) => ({
        target,
        value,
        calldata,
      })),
    [selectedDraft.actions]
  );
  const {
    data: decodedActions,
    isLoading: isDecoding,
    isError: isDecodeError,
  } = useDecodedActions({
    actions: decoderActions,
    extraData: selectedDraft.extraData,
    chainId,
  });
  const totals = reviewTotals(selectedDraft);

  function updateSelectedActions(nextActions: Draft["actions"]) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.id !== selectedDraft.id) return draft;

        return {
          ...draft,
          actions: nextActions,
        };
      })
    );
  }

  function submitReview(decision: ReviewDecision) {
    if (!reviewComment.trim() || !address) return;

    const nextReview: DraftReview = {
      id: `review-${Date.now()}`,
      draftId: selectedDraft.id,
      reviewer: address,
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

  return (
    <div className="mx-auto grid w-full max-w-[1440px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge variant="secondary">
              <GitBranch className="size-3" />
              Calldata #{selectedDraft.id}
            </Badge>
            <Badge variant="outline">{selectedDraft.timestamp}</Badge>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Calldata #{selectedDraft.id}
          </h1>
          <div className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <span className="break-all font-mono">
              Author {selectedDraft.proposer}
            </span>
            <span className="break-all font-mono">
              Executor {selectedDraft.executor}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            <ArrowLeft className="size-4" />
            Calldata Registry Protocol
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={forkPath(selectedDraft)} />}
          >
            <GitFork className="size-4" />
            Fork
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            Lineage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HistoryGraph drafts={draftFamily} selectedDraft={selectedDraft} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
          <CardDescription>Published description.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-card p-4">
            <p className="whitespace-pre-wrap text-sm leading-6">
              {selectedDraft.description || "No description"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="size-4" />
            Calls
          </CardTitle>
          <CardDescription>
            Decode calls first; switch to raw calldata when you need the exact
            payload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="decoded" className="gap-4">
            <TabsList>
              <TabsTrigger value="decoded">Decoded</TabsTrigger>
              <TabsTrigger value="raw">Raw</TabsTrigger>
            </TabsList>
            <TabsContent value="decoded">
              <DecodedCallsPanel
                actions={selectedDraft.actions}
                decodedActions={decodedActions}
                isLoading={isDecoding}
                isError={isDecodeError}
              />
            </TabsContent>
            <TabsContent value="raw">
              <CalldataCallBuilder
                actions={selectedDraft.actions}
                onChange={updateSelectedActions}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            Reviews
          </CardTitle>
          <CardDescription>
            Review records and local approve or reject action.
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline">{totals.approved} approved</Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {totals.rejected} rejected
              </Badge>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <ReviewsList reviews={selectedDraft.reviews} />

          <div className="grid gap-4 content-start rounded-lg border p-4">
            <div className="grid gap-1">
              <h3 className="text-sm font-medium">Submit review</h3>
              <p className="text-sm text-muted-foreground">
                Approve or reject the selected record.
              </p>
            </div>
            <Separator />
            <div className="grid gap-2">
              <Label>Reviewer wallet</Label>
              <div className="min-h-10 break-all rounded-lg border bg-muted px-3 py-2 font-mono text-sm text-muted-foreground">
                {address ?? "Not connected"}
              </div>
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
                disabled={!reviewComment.trim() || !address}
              >
                <CheckCircle2 className="size-4" />
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => submitReview("rejected")}
                disabled={!reviewComment.trim() || !address}
              >
                <XCircle className="size-4" />
                Reject
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
