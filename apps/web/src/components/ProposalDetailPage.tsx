"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  mockDrafts,
  type Draft,
  type DraftReview,
  type ReviewDecision,
} from "@/lib/mock-proposals";

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
      <div className="relative h-[320px] min-w-[720px] bg-card">
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
              href={`/drafts/${draft.id}`}
              aria-current={isSelected ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: isSelected ? "default" : "outline" }),
                "absolute z-10 h-16 w-40 -translate-x-1/2 -translate-y-1/2 flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left",
                !isSelected && "bg-background"
              )}
              style={{ left: `${draft.x}%`, top: `${draft.y}%` }}
            >
              <span className="flex items-center gap-1 text-xs">
                <GitBranch className="size-3" />
                Calldata #{draft.id}
              </span>
              <span className="font-mono text-[0.68rem] opacity-75">
                {shortAddress(draft.proposer)}
              </span>
              <span className="text-[0.68rem] opacity-75">
                {draft.timestamp}
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
        No reviews recorded for this calldata.
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

export function ProposalDetailPage({
  initialDraftId,
}: {
  initialDraftId: string;
}) {
  const initialDraft =
    mockDrafts.find((draft) => draft.id === initialDraftId) ?? mockDrafts[0];
  const [drafts, setDrafts] = useState<Draft[]>(mockDrafts);
  const [reviewer, setReviewer] = useState("0xReviewer");
  const [reviewComment, setReviewComment] = useState("");

  const selectedDraft =
    drafts.find((draft) => draft.id === initialDraftId) ?? initialDraft;
  const draftFamily = useMemo(
    () => getDraftFamily(drafts, selectedDraft),
    [drafts, selectedDraft]
  );
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
            Calldata
          </Button>
          <Button
            nativeButton={false}
            render={<Link href={`/drafts/new?previousVersion=${selectedDraft.id}`} />}
          >
            <GitFork className="size-4" />
            Fork
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="size-4" />
            Graph
          </CardTitle>
          <CardDescription>
            Calldata versions linked through previousVersion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HistoryGraph drafts={draftFamily} selectedDraft={selectedDraft} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
          <CardDescription>Calldata description from the mocked record.</CardDescription>
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
            Calldata
          </CardTitle>
          <CardDescription>
            Review the full calls array and edit target, value, or calldata locally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CalldataCallBuilder
            actions={selectedDraft.actions}
            onChange={updateSelectedActions}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            Reviews
          </CardTitle>
          <CardDescription>
            Review records and local approve or reject action for this calldata.
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
                Approve or reject the selected calldata.
              </p>
            </div>
            <Separator />
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
